// Runs once, the first time the MongoDB container starts with an empty data volume.
// Creates a least-privilege app user and the indexes the app relies on.

const dbName = process.env.MONGO_INITDB_DATABASE || 'ptc_chms';
const appUser = process.env.MONGO_APP_USER || 'ptc_app';
const appPassword = process.env.MONGO_APP_PASSWORD || 'change-me-app';

const appDb = db.getSiblingDB(dbName);

appDb.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [{ role: 'readWrite', db: dbName }],
});

appDb.people.createIndex({ phone: 1 }, { unique: true });
appDb.people.createIndex({ stage: 1 });
appDb.people.createIndex({ assignedTo: 1 });
appDb.visits.createIndex({ person: 1, serviceDate: 1, service: 1 }, { unique: true });
appDb.attendances.createIndex({ serviceDate: 1, service: 1 }, { unique: true });
appDb.users.createIndex({ username: 1 }, { unique: true });
appDb.smslogs.createIndex({ createdAt: -1 });

print(`Initialised database ${dbName} with user ${appUser}`);
