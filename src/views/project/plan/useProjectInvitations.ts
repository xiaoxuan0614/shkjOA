import { computed, ref } from 'vue';
import { projectDetail } from '../Project.api';
import { contractDetail } from '/@/views/payment/Payment.api';
import { invitationList, respondInvitation } from './Invite.api';

export interface ProjectInvitation extends Recordable {
  id: string;
  periodId: string;
  projectName: string;
  periodName: string;
  projectManagerName: string;
}

const invitations = ref<ProjectInvitation[]>([]);
const total = ref(0);
const loading = ref(false);
let pendingRequest: Promise<void> | null = null;

function unwrapPage(payload: any) {
  let page = payload;
  for (let depth = 0; depth < 3 && page?.result && !Array.isArray(page.records); depth += 1) page = page.result;
  return {
    records: Array.isArray(page) ? page : page?.records || [],
    total: Number(page?.total ?? (Array.isArray(page) ? page.length : page?.records?.length) ?? 0),
  };
}

async function loadInvitationContext(periodId: string) {
  const [projectResult, contractResult] = await Promise.allSettled([
    periodId ? projectDetail({ periodId }) : Promise.resolve({}),
    periodId ? contractDetail({ periodId }) : Promise.resolve({}),
  ]);
  const project: any = projectResult.status === 'fulfilled' ? projectResult.value || {} : {};
  const contract: any = contractResult.status === 'fulfilled' ? contractResult.value || {} : {};
  return { project, contract };
}

async function enrichInvitation(record: Recordable, contextPromise: Promise<Recordable>): Promise<ProjectInvitation> {
  const periodId = String(record.periodId || '');
  const { project, contract } = await contextPromise;
  return {
    ...record,
    id: String(record.id || ''),
    periodId,
    projectName: project.projectName || record.projectName || '',
    periodName: project.periodName || record.periodName || '',
    projectManagerName:
      contract.projectManagerUserName ||
      contract.projectManagerName ||
      record.projectManagerUserName ||
      record.inviterName ||
      record.createBy ||
      '项目经理',
  };
}

async function refreshInvitations(force = false) {
  if (pendingRequest && !force) return pendingRequest;
  pendingRequest = (async () => {
    loading.value = true;
    try {
      const page = unwrapPage(await invitationList({ pageNo: 1, pageSize: 100 }));
      const contextByPeriod = new Map<string, Promise<Recordable>>();
      invitations.value = await Promise.all(
        page.records.map((record) => {
          const periodId = String(record.periodId || '');
          if (!contextByPeriod.has(periodId)) contextByPeriod.set(periodId, loadInvitationContext(periodId));
          return enrichInvitation(record, contextByPeriod.get(periodId)!);
        })
      );
      total.value = page.total;
    } finally {
      loading.value = false;
      pendingRequest = null;
    }
  })();
  return pendingRequest;
}

async function handleInvitation(memberId: string, inviteStatus: '0' | '1') {
  await respondInvitation({ memberId, inviteStatus });
  invitations.value = invitations.value.filter((item) => String(item.id) !== String(memberId));
  total.value = Math.max(0, total.value - 1);
}

export function useProjectInvitations() {
  return {
    invitations,
    invitationTotal: computed(() => total.value),
    invitationLoading: loading,
    refreshInvitations,
    handleInvitation,
  };
}
