import assert from 'node:assert/strict';
import { resolveReworkName, reworkHistory } from '../src/utils/reworkRound.ts';

async function main() {
  const rows: Record<string, any> = {
    first: { id: 'first', periodId: 'p', approvalStatus: '1', previousReworkId: null, version: 98 },
    second: { id: 'second', periodId: 'p', approvalStatus: '1', previousReworkId: 'first' },
    rejected: { id: 'rejected', periodId: 'p', approvalStatus: '0' },
    foreign: { id: 'foreign', periodId: 'other', approvalStatus: '1' },
    cycle: { id: 'cycle', periodId: 'p', approvalStatus: '1', previousReworkId: 'cycle' },
  };
  const read = async (id: string) => rows[id];
  assert.equal(await resolveReworkName('', 'p', read), '第1轮返工');
  assert.equal(await resolveReworkName('first', 'p', read), '第2轮返工');
  assert.equal(await resolveReworkName('second', 'p', read), '第3轮返工');
  // Rejected/withdrawn/resubmitted attempts use the same predecessor, not their version or count.
  for (let attempt = 0; attempt < 3; attempt++) assert.equal(await resolveReworkName('first', 'p', read), '第2轮返工');
  for (const id of ['missing', 'rejected', 'foreign', 'cycle']) await assert.rejects(resolveReworkName(id, 'p', read));
  assert.deepEqual(reworkHistory('broken'), []);
  assert.deepEqual(reworkHistory('[null,1,{"action":"SUBMIT"}]'), [{ action: 'SUBMIT' }]);
  console.log('返工回归通过：首轮、多轮、重提、版本独立、缺链、未审批、跨项目、循环链及历史解析');
}
void main();
