import type { DesignNode } from './graph';

export interface CanvasEntry {
  key: string;
  node?: DesignNode;
  index: number;
  group?: { id: string; nodes: DesignNode[] };
}

/** Presentation only. Never serialize groups or replace the executable nodes. */
export function canvasEntries(nodes: DesignNode[], expanded: ReadonlySet<string>, threshold = 3): CanvasEntry[] {
  const entries: CanvasEntry[] = [];
  const dynamic = (node: DesignNode) => node.kind === 'APPROVAL' && !node.branches &&
    node.approval?.approverRules?.some(rule => rule.type === 'FORM_USERS');
  for (let index = 0; index < nodes.length;) {
    let end = index;
    if (dynamic(nodes[index])) while (end < nodes.length && dynamic(nodes[end])) end++;
    if (end - index >= Math.max(2, threshold)) {
      const members = nodes.slice(index, end);
      const id = JSON.stringify(members.map(node => node.id));
      entries.push({ key: `group:${id}`, index, group: {id, nodes:members} });
      if (expanded.has(id)) members.forEach((node, offset) => entries.push({key:node.id,node,index:index + offset}));
      index = end;
    } else {
      entries.push({key:nodes[index].id,node:nodes[index],index});
      index++;
    }
  }
  return entries;
}
