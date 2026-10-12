import type { FormSchema } from '/@/components/Table';

/** Shared customer/supplier fields; retain their existing business-specific fields. */
export function extendCounterpartyForm(schemas: FormSchema[], kind: '客户' | '供应商'): FormSchema[] {
  const text = (label: string, field: string, maxLength: number): FormSchema => ({
    label,
    field,
    component: 'Input',
    componentProps: { placeholder: `请输入${label}`, maxlength: maxLength, allowClear: true },
    rules: [{ max: maxLength, message: `${label}不能超过${maxLength}字` }],
  });
  const extra: FormSchema[] = [
    text(`${kind}分类`, 'counterpartyCategory', 32),
    text('主联系人传真号', 'contactFax', 64),
    {
      ...text('主联系人电子邮件', 'contactEmail', 128),
      rules: [
        { max: 128, message: '电子邮件不能超过128字' },
        { type: 'email', message: '请输入有效的电子邮件地址' },
      ],
    },
    text('联行号', 'bankRoutingNo', 32),
    text('收付款条件', 'paymentTerms', 100),
    text('法人代表', 'legalRepresentative', 128),
    ...(!schemas.some((item) => item.field === 'taxNo') ? [text('社会信用代码', 'taxNo', 64)] : []),
    { label: '创建人', field: 'createBy', component: 'Input', componentProps: { disabled: true, placeholder: '保存后由系统自动生成' } },
    {
      label: '建档日期',
      field: 'sourceCreatedOn',
      component: 'DatePicker',
      componentProps: {
        valueFormat: 'YYYY-MM-DD',
        format: 'YYYY-MM-DD',
        placeholder: '请选择建档日期（选填）',
        allowClear: true,
        style: { width: '100%' },
      },
    },
    text('状态', 'sourceStatus', 32),
    {
      label: '税率（%）',
      field: 'taxRate',
      component: 'InputNumber',
      componentProps: {
        placeholder: '例如：13 表示 13%',
        style: { width: '100%' },
      },
    },
    {
      label: '票据类型',
      field: 'invoiceType',
      component: 'Select',
      componentProps: {
        placeholder: '请选择票据类型',
        allowClear: true,
        options: [
          { label: '专票', value: '专票' },
          { label: '普票', value: '普票' },
        ],
      },
    },
    ...(['longitude', 'latitude'] as const).map((field): FormSchema => ({
      label: field === 'longitude' ? '位置经度' : '位置纬度',
      field,
      component: 'InputNumber',
      componentProps: { disabled: true, placeholder: '地图选点后自动获取', style: { width: '100%' } },
    })),
  ];
  const fields = schemas.map((schema): FormSchema => {
    if (schema.field === 'contactPerson') return { ...schema, label: '主联系人' };
    if (schema.field === 'contactPhone') return { ...schema, label: '主联系人电话' };
    if (schema.field === 'taxNo') return { ...schema, label: '社会信用代码', componentProps: { placeholder: '请输入社会信用代码' } };
    if (schema.field !== 'address') return schema;
    return {
      ...schema,
      label: '主联系人地址',
      component: 'AMapLocationSelect',
      colProps: { span: 24 },
      componentProps: ({ formModel, formActionType }) => ({
        placeholder: '请选择主联系人地址',
        inline: false,
        autoLocate: false,
        mapHeight: '320px',
        lng: formModel.longitude ?? null,
        lat: formModel.latitude ?? null,
        onSelect: (poi: { lng?: number; lat?: number; address?: string; name?: string } | null) => {
          // Only the map's confirmed selection updates the persisted form fields.
          if (!poi || !Number.isFinite(poi.lng) || !Number.isFinite(poi.lat)) return;
          formActionType.setFieldsValue({ address: poi.address || poi.name || '', longitude: poi.lng, latitude: poi.lat });
        },
      }),
    };
  });
  const index = fields.findIndex((item) => item.field === 'remark');
  fields.splice(index < 0 ? fields.length : index, 0, ...extra);
  return fields;
}

/** Blank means omitted, not a request to clear persisted data. Zero remains meaningful. */
export function buildCounterpartyPayload(values: Record<string, unknown>): Record<string, unknown> {
  const serverFields = new Set([
    'createBy',
    'createTime',
    'updateBy',
    'updateTime',
    'sourceCreatedBy',
    'sourceUpdatedBy',
    'sourceUpdatedOn',
    'delFlag',
  ]);
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => !serverFields.has(key) && value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '')
    )
  );
}
