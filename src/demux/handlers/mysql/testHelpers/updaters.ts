async function addTodo(_state: null, payload: any, _blockInfo: any, context: any) {
  await context.conn.query(`INSERT INTO todo VALUES (${payload.id}, "${payload.todoName}")`);
}

async function addTasks(_state: null, payload: any, _blockInfo: any, context: any) {
  for (const task of payload.tasks) {
    await context.conn.query(`INSERT INTO task (todo_id, name) VALUES (${payload.todoId}, "${task}")`);
  }
}

async function updateTask(_state: null, payload: any, _blockInfo: any, context: any) {
  const rows = await context.conn.query(`SELECT * FROM task WHERE name="${payload.taskName}" LIMIT 1`);
  const id = rows[0].id;
  await context.conn.query(`UPDATE task SET completed=${payload.completed} WHERE id=${id}`);
}

export default [
  {
    actionType: "add_todo",
    updater: addTodo,
  },
  {
    actionType: "add_tasks",
    updater: addTasks,
  },
  {
    actionType: "update_task",
    updater: updateTask,
  },
]
