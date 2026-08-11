/** Add stable anchors to the ordered list immediately following a Steps heading. */
export default function satteriRecipeStepIds() {
  return {
    name: 'kavovo-recipe-step-ids',
    element: {
      filter: ['ol'],
      visit(node, context) {
        const parent = context.parent(node);
        const listIndex = context.indexOf(node);
        if (!parent || listIndex === undefined) return;

        let previous;
        for (let index = listIndex - 1; index >= 0; index -= 1) {
          const candidate = parent.children[index];
          if (candidate?.type === 'text' && candidate.value.trim() === '') continue;
          previous = candidate;
          break;
        }
        if (
          previous?.type !== 'element' ||
          !/^h[1-6]$/.test(previous.tagName) ||
          context.textContent(previous).trim().toLowerCase() !== 'steps'
        ) {
          return;
        }

        let stepIndex = 0;
        for (const child of node.children) {
          if (child?.type !== 'element' || child.tagName !== 'li') continue;
          stepIndex += 1;
          context.setProperty(child, 'id', `step-${stepIndex}`);
        }
      },
    },
  };
}
