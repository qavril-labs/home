import type { Batch, BatchRecord, InventoryStore, InventoryTx, Movement, MovementType } from "./inventory";

/** Store for unit tests and local runs. Production uses the Postgres store in @erp/db. */
export class InMemoryInventoryStore implements InventoryStore {
  private batchRows: BatchRecord[] = [];
  private movementRows: Movement[] = [];
  private queues = new Map<string, Promise<unknown>>();

  async batches(companyId: string): Promise<Batch[]> {
    return derive(companyId, this.batchRows, this.movementRows);
  }

  /** Every movement of the company, in the order it was posted. */
  movementsOf(companyId: string): Movement[] {
    return this.movementRows.filter((movement) => movement.companyId === companyId);
  }

  /**
   * Calls for one company run one after another. Writes made by a call are staged and applied only
   * when the call returns, so a failed call leaves no stock behind.
   */
  async transaction<T>(companyId: string, work: (tx: InventoryTx) => Promise<T>): Promise<T> {
    const previous = this.queues.get(companyId) ?? Promise.resolve();
    const run = previous.then(async () => {
      const staged = { batches: [] as BatchRecord[], movements: [] as Movement[] };
      const visibleMovements = () => [...this.movementRows, ...staged.movements];
      const tx: InventoryTx = {
        batches: async () => derive(companyId, [...this.batchRows, ...staged.batches], visibleMovements()),
        movementsFor: async (reference: string, type: MovementType) =>
          visibleMovements().filter(
            (movement) => movement.companyId === companyId && movement.reference === reference && movement.type === type,
          ),
        createBatch: async (batch, receipt) => {
          staged.batches.push(batch);
          staged.movements.push(receipt);
        },
        appendMovements: async (movements) => {
          staged.movements.push(...movements);
        },
      };
      const result = await work(tx);
      this.batchRows.push(...staged.batches);
      this.movementRows.push(...staged.movements);
      return result;
    });
    this.queues.set(
      companyId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}

/** Balances are the sum of each batch's movements. Nothing is stored as a balance. */
function derive(companyId: string, batches: readonly BatchRecord[], movements: readonly Movement[]): Batch[] {
  const balance = new Map<string, bigint>();
  for (const movement of movements) {
    if (movement.companyId !== companyId) continue;
    balance.set(movement.batchId, (balance.get(movement.batchId) ?? 0n) + movement.qty);
  }
  return batches
    .filter((batch) => batch.companyId === companyId)
    .map((batch) => ({ ...batch, balance: balance.get(batch.id) ?? 0n }));
}
