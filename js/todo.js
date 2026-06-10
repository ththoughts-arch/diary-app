/* ── todo.js ── */
const Todo = (() => {
  function add() {
    const input = document.getElementById('todo-input');
    const text = input?.value?.trim();
    if (!text) return;
    Store.Todos.add(text);
    input.value = '';
    Home.renderTodos();
  }
  function toggle(id) {
    Store.Todos.toggle(id);
    Home.renderTodos();
  }
  function remove(id) {
    Store.Todos.remove(id);
    Home.renderTodos();
  }
  return { add, toggle, remove };
})();
