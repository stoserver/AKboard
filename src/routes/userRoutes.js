const express = require('express');
const { authRequired } = require('../middleware/auth');
const boardService = require('../services/boardService');

const router = express.Router();

router.use(authRequired);

router.get('/dashboard', (req, res) => {
  const boards = boardService.listBoardsForRoles(req.user.roles);
  res.render('user/dashboard', { user: req.user, boards });
});

router.get('/boards/:boardId', (req, res) => {
  const boardId = Number(req.params.boardId);
  const allBoards = boardService.listBoardsForRoles(req.user.roles);
  const board = allBoards.find((item) => item.id === boardId);

  if (!board) {
    return res.status(403).render('error', { message: '접근할 수 없는 게시판입니다.' });
  }

  const posts = boardService.listPostsByBoard(boardId);
  return res.render('user/board', { user: req.user, board, posts, error: null });
});

router.post('/boards/:boardId/posts', (req, res) => {
  const boardId = Number(req.params.boardId);
  const { title, content } = req.body;
  const boards = boardService.listBoardsForRoles(req.user.roles);
  const board = boards.find((item) => item.id === boardId);

  if (!board) {
    return res.status(403).render('error', { message: '접근할 수 없는 게시판입니다.' });
  }

  if (!title || !content) {
    const posts = boardService.listPostsByBoard(boardId);
    return res.render('user/board', { user: req.user, board, posts, error: '제목과 내용을 모두 입력하세요.' });
  }

  boardService.createPost({ boardId, userId: req.user.id, title, content });
  return res.redirect(`/user/boards/${boardId}`);
});

module.exports = router;
