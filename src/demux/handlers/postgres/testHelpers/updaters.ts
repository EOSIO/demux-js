async function addTodo(db: any, payload: any) {
  await db.todo.insert({
    id: payload.id,
    name: payload.todoName,
  })
}

async function addTasks(db: any, payload: any) {
  for (const task of payload.tasks) {
    await db.task.insert({
      todo_id: payload.todoId,
      name: task,
    })
  }
}

async function updateTask(db: any, payload: any) {
  const task = await db.task.findOne({ name: payload.taskName })
  await db.task.update({ id: task.id }, { completed: payload.completed })
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
