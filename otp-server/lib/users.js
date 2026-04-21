const usersByEmail = new Map();
const usersById = new Map();

let nextId = 1;

function findByEmail(email) {
  return usersByEmail.get(email.toLowerCase());
}

function findById(id) {
  return usersById.get(id);
}

function upsertGoogleUser({ googleId, email, name, picture }) {
  const normalizedEmail = email.toLowerCase();
  let user = usersByEmail.get(normalizedEmail);

  if (user) {
    user.name = name || user.name;
    user.picture = picture || user.picture;
    user.googleId = googleId;
    user.lastLoginAt = new Date().toISOString();
    return user;
  }

  user = {
    id: String(nextId++),
    googleId,
    email: normalizedEmail,
    name: name || normalizedEmail.split('@')[0],
    picture: picture || null,
    provider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  usersById.set(user.id, user);
  usersByEmail.set(normalizedEmail, user);
  return user;
}

function listUsers() {
  return Array.from(usersById.values());
}

module.exports = {
  findByEmail,
  findById,
  upsertGoogleUser,
  listUsers,
};
