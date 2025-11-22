#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../backend"
node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const MONGO_URI = process.env.MONGO_URI || process.env.E2E_MONGO_URI || 'mongodb://localhost:27017/delta5';
const baseUsers = [
  {
    _id: 'admin',
    id: 'admin',
    name: 'admin',
    mail: 'admin@dreaktor.com',
    password: bcrypt.hashSync('P@ssw0rd!', 10),
    roles: ['subscriber', 'administrator'],
    confirmed: true,
    limitWorkflows: 0,
    limitNodes: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'subscriber',
    id: 'subscriber',
    name: 'subscriber',
    mail: 'subscriber@dreaktor.com',
    password: bcrypt.hashSync('P@ssw0rd!', 10),
    roles: ['subscriber'],
    confirmed: true,
    limitWorkflows: 10,
    limitNodes: 300,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'customer',
    id: 'customer',
    name: 'customer',
    mail: 'customer@dreaktor.com',
    password: bcrypt.hashSync('P@ssw0rd!', 10),
    roles: ['customer'],
    confirmed: true,
    limitWorkflows: 10,
    limitNodes: 1500,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    await db.collection('waitlists').deleteMany({});
    for (const user of baseUsers) {
      await db.collection('users').deleteMany({\$or: [{id: user.id}, {mail: user.mail}]});
      await db.collection('users').insertOne(user);
    }
    console.log('E2E base users seeded: admin, subscriber, customer');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed E2E users:', error.message);
    process.exit(1);
  }
})();
"
