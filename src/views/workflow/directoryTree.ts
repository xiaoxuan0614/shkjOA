import type { DirectoryEntry } from './workflow.types';
export interface DepartmentTreeNode {
  key: string;
  title: string;
  children: DepartmentTreeNode[];
}
export function departmentTree(rows: DirectoryEntry[]): DepartmentTreeNode[] {
  const entries = new Map(rows.map((row) => [row.id, row]));
  const nodes = new Map(rows.map((row) => [row.id, { key: row.id, title: row.name || row.id, children: [] as DepartmentTreeNode[] }]));
  const roots: DepartmentTreeNode[] = [];
  for (const [id, node] of nodes) {
    const parent = entries.get(id)?.parent_id;
    let cursor: string | null | undefined = parent,
      cycle = false;
    const seen = new Set([id]);
    while (cursor && entries.has(cursor)) {
      if (seen.has(cursor)) {
        cycle = true;
        break;
      }
      seen.add(cursor);
      cursor = entries.get(cursor)?.parent_id;
    }
    if (parent && nodes.has(parent) && !cycle) nodes.get(parent)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}
