const express = require('express');
const router = express.Router();
const todosController = require('../controllers/todosController');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', todosController.getAllTodos);
router.post('/', todosController.createTodo);
router.put('/:id', todosController.updateTodo);
router.delete('/:id', todosController.deleteTodo);

module.exports = router;
