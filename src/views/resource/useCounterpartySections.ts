import { computed, h, nextTick, ref } from 'vue';
import type { FormSchema } from '/@/components/Table';

const basic = new Set([
  'supplierName',
  'supplierNo',
  'customerName',
  'customerNo',
  'contactPerson',
  'contactPhone',
  'address',
  'counterpartyCategory',
]);
const finance = new Set([
  'bankName',
  'bankAccount',
  'bankRoutingNo',
  'paymentTerms',
  'taxNo',
  'taxRate',
  'invoiceType',
  'invoiceTitle',
  'invoiceAddress',
  'invoicePhone',
]);
export function counterpartySection(field: string): string {
  return basic.has(field) ? 'basic' : finance.has(field) ? 'finance' : 'other';
}

/** CSS-only collapse keeps all fields mounted, including their values and validators. */
export function useCounterpartySections(fields: FormSchema[], onResize: () => void) {
  const open = ref(['basic']);
  const formClass = computed(() => ['counterparty-form', ...open.value.map((key) => `counterparty-open-${key}`)]);
  async function resize() {
    await nextTick();
    onResize();
  }
  function toggle(key: string) {
    open.value = open.value.includes(key) ? open.value.filter((item) => item !== key) : [...open.value, key];
    void resize();
  }
  const schemas: FormSchema[] = ['basic', 'finance', 'other'].flatMap((key, index) => [
    {
      field: `_section_${key}`,
      label: '',
      component: 'Input',
      colProps: { span: 24 },
      renderColContent: () =>
        h(
          'button',
          {
            type: 'button',
            class: 'counterparty-section-toggle',
            'aria-expanded': open.value.includes(key),
            onClick: () => toggle(key),
          },
          [
            h('span', ['重要信息', '财务与开票信息', '其他资料'][index]),
            h('span', { class: 'counterparty-section-action' }, open.value.includes(key) ? '收起 −' : '展开 ＋'),
          ]
        ),
    },
    ...fields
      .filter((field) => counterpartySection(field.field) === key)
      .map((field) => ({
        ...field,
        colProps: { ...field.colProps, class: `counterparty-field-${key}` },
      })),
  ]);
  function resetSections() {
    open.value = ['basic'];
    void resize();
  }
  async function revealField(field: string | string[]) {
    const key = counterpartySection(Array.isArray(field) ? field[0] : field);
    if (!open.value.includes(key)) open.value = [...open.value, key];
    await resize();
  }
  return { schemas, formClass, resetSections, revealField };
}
