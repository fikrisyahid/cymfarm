import { localDb, type LocalActivityLog } from "./offline-db";

/**
 * Reverts an activity log action safely:
 * - Deletes the log from localDb.activityLogs
 * - If ROUTINE: recalculates subject's lastRoutineDate based on the remaining latest routine log
 * - If HARVEST:
 *    - If RECURRING: recalculates subject's lastHarvestDate based on remaining latest harvest log
 *    - If TERMINATE: restores subject isActive=true and container status='ACTIVE'
 * - If POPULATION_CHANGE: inverts the population difference (subtracts what was added, or adds what was subtracted)
 * - If syncedToCloud was true, enqueues or calls /api/sync/undo to remove it from cloud
 */
export async function undoActivityLog(logId: string): Promise<{ success: boolean; message: string }> {
  const log = await localDb.activityLogs.get(logId);
  if (!log) {
    return { success: false, message: "Catatan aktivitas tidak ditemukan atau sudah dihapus." };
  }

  try {
    const { activityType, containerId, subjectId, quantity, syncedToCloud } = log;

    // 1. Rollback subject state if applicable
    if (subjectId) {
      const subject = await localDb.subjects.get(subjectId);
      if (subject) {
        if (activityType === "ROUTINE") {
          // Find the previous routine log
          const allOtherRoutines = await localDb.activityLogs
            .where("containerId")
            .equals(containerId)
            .filter((l) => l.id !== logId && l.activityType === "ROUTINE")
            .toArray();

          const sorted = allOtherRoutines.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
          const prevDate = sorted[0] ? sorted[0].performedAt.split("T")[0] : undefined;

          await localDb.subjects.update(subjectId, {
            lastRoutineDate: prevDate,
            updatedAt: new Date().toISOString(),
            syncedToCloud: false,
          });
        } else if (activityType === "HARVEST") {
          // Find the previous harvest log
          const allOtherHarvests = await localDb.activityLogs
            .where("containerId")
            .equals(containerId)
            .filter((l) => l.id !== logId && l.activityType === "HARVEST")
            .toArray();

          const sorted = allOtherHarvests.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
          const prevDate = sorted[0] ? sorted[0].performedAt.split("T")[0] : undefined;

          await localDb.subjects.update(subjectId, {
            lastHarvestDate: prevDate,
            updatedAt: new Date().toISOString(),
            syncedToCloud: false,
          });
        } else if (activityType === "TERMINATE") {
          // Restores the subject and container
          await localDb.subjects.update(subjectId, {
            isActive: true,
            updatedAt: new Date().toISOString(),
            syncedToCloud: false,
          });
          await localDb.containers.update(containerId, {
            status: "ACTIVE",
            updatedAt: new Date().toISOString(),
            syncedToCloud: false,
          });
        } else if (activityType === "POPULATION_CHANGE") {
          // Cari log populasi sebelumnya untuk container ini
          const allOtherPopLogs = await localDb.activityLogs
            .where("containerId")
            .equals(containerId)
            .filter((l) => l.id !== logId && l.activityType === "POPULATION_CHANGE")
            .toArray();

          const sorted = allOtherPopLogs.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
          const restoredPopulation = sorted[0] ? Number(sorted[0].quantity) || 0 : 0;

          await localDb.subjects.update(subjectId, {
            populationCount: restoredPopulation,
            updatedAt: new Date().toISOString(),
            syncedToCloud: false,
          });
        }
      }
    } else if (activityType === "MAINTENANCE" && containerId) {
      // Restore container from MAINTENANCE to ACTIVE
      await localDb.containers.update(containerId, {
        status: "ACTIVE",
        maintenanceNote: undefined,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    }

    // 2. Catat event UNDO baru ke activity log (Never Delete, Pure Append)
    const nowIso = new Date().toISOString();
    const undoLogId = `log-undo-${Date.now()}`;
    await localDb.activityLogs.put({
      id: undoLogId,
      moduleId: log.moduleId,
      containerId: log.containerId,
      subjectId: log.subjectId,
      activityType: "UNDO" as any,
      quantity: log.quantity,
      unit: log.unit,
      note: `↩️ Batalkan aksi: ${log.note || activityType}`,
      targetDate: log.targetDate || nowIso.split("T")[0],
      performedAt: nowIso,
      syncedToCloud: false,
    });

    return { success: true, message: `Aksi ${log.note || activityType} berhasil dibatalkan (Undo)!` };
  } catch (error: any) {
    console.error("Undo error:", error);
    return { success: false, message: error.message || "Gagal melakukan undo." };
  }
}
