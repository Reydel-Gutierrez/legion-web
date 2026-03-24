const userService = require('./user.service');

async function list(req, res) {
  const users = await userService.listUsers();
  res.json(users);
}

async function create(req, res) {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
}

async function listBySite(req, res) {
  const accessRows = await userService.listUsersBySite(req.params.siteId);
  res.json(accessRows);
}

module.exports = {
  list,
  create,
  listBySite,
};
