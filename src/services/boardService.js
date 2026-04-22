const { getDb } = require('../db');

const db = getDb();

function listBoardsForRoles(roles) {
  const boards = db.prepare('SELECT * FROM boards ORDER BY id ASC').all();
  return boards.filter((board) => !board.required_role || roles.includes(board.required_role));
}

function listAllBoards() {
  return db.prepare('SELECT * FROM boards ORDER BY id ASC').all();
}

function createBoard({ slug, title, description, requiredRole }) {
  db.prepare(
    'INSERT INTO boards(slug, title, description, required_role) VALUES (?, ?, ?, ?)'
  ).run(slug, title, description, requiredRole || null);
}

function updateBoard(id, payload) {
  db.prepare(
    `UPDATE boards
      SET slug = ?, title = ?, description = ?, required_role = ?
      WHERE id = ?`
  ).run(payload.slug, payload.title, payload.description, payload.requiredRole || null, id);
}

function deleteBoard(id) {
  db.prepare('DELETE FROM boards WHERE id = ?').run(id);
}

function createPost({ boardId, userId, title, content }) {
  db.prepare('INSERT INTO posts(board_id, user_id, title, content) VALUES (?, ?, ?, ?)').run(boardId, userId, title, content);
}

function listPostsByBoard(boardId) {
  return db
    .prepare(
      `SELECT p.id, p.title, p.content, p.created_at, u.username
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.board_id = ?
       ORDER BY p.id DESC`
    )
    .all(boardId);
}

module.exports = {
  listBoardsForRoles,
  listAllBoards,
  createBoard,
  updateBoard,
  deleteBoard,
  createPost,
  listPostsByBoard
};
