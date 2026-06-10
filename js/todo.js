/* ── todo.js ── */
const Todo = (() => {
  async function add() {
    const input = document.getElementById('todo-input');
    const text = input?.value?.trim();
    if (!text) return;
    await Store.Todos.add(text);
    input.value = '';
    Home.renderTodos();
  }
  async function toggle(id) {
    await Store.Todos.toggle(id);
    Home.renderTodos();
  }
  async function remove(id) {
    await Store.Todos.remove(id);
    Home.renderTodos();
  }
  return { add, toggle, remove };
})();
