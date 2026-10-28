const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let connect;
const clients = new Map();
const roomEvents = [];
const io = {
  on: (event, handler) => { connect = handler; },
  sockets: { sockets: clients },
  to: room => ({ emit: (...args) => roomEvents.push([room, ...args]) })
};
const routes = {};
const app = { use() {}, get: (path, handler) => { routes[path] = handler; } };
const express = Object.assign(() => app, { static() {} });
const context = {
  require: name => name === 'express' ? express : name === 'http'
    ? { createServer: () => ({ listen() {} }) } : name === 'socket.io'
      ? { Server: function () { return io; } } : require(name),
  __dirname, console: { log() {} }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('index.js', 'utf8') + '\nthis.state = sessions;', context);
function client(id) {
  const handlers = {};
  const socket = {
    id,
    data: {}, events: [], rooms: new Set(),
    on: (event, handler) => { handlers[event] = handler; },
    emit: (...args) => socket.events.push(args),
    join: room => socket.rooms.add(room),
    leave: room => socket.rooms.delete(room),
    send: (event, ...args) => handlers[event](...args)
  };
  clients.set(id, socket);
  connect(socket);
  return socket;
}
const host = client('host'), joiner = client('joiner'), third = client('third');
host.send('startTask', { taskId: '123', user: 'HOST' });
joiner.send('joinTask', { taskId: '123', user: 'JOINER' });
third.send('joinTask', { taskId: '123', user: 'THIRD' });
function assertSingleHost(expected) {
  const hosts = [...clients.values()].filter(client => client.data.membership?.taskId === '123')
    .filter(client => client.events.filter(event => event[0] === 'isHost').at(-1)?.[1] === true);
  assert.equal(hosts.length, 1);
  assert.equal(hosts[0].id, expected);
}
assertSingleHost('host');
third.send('startTask', { taskId: '123', user: 'THIRD' });
assertSingleHost('host');
third.send('revealVotes', '123');
assert.equal(context.state['123'].revealed, false);
joiner.send('castVote', { taskId: '123', user: 'JOINER', vote: 13 });
host.send('castVote', { taskId: '123', user: 'HOST', vote: 8 });
let acknowledged = false;
joiner.send('leaveSession', () => { acknowledged = true; });
assert(acknowledged);
assert(!joiner.rooms.has('123'));
assert(!context.state['123'].users.JOINER);
assert(!context.state['123'].votes.JOINER);
assert.equal(context.state['123'].votes.HOST, 8);
assert.equal(context.state['123'].host, 'HOST');
joiner.send('joinTask', { taskId: '123', user: 'JOINER' });
assert(context.state['123'].users.JOINER);
assert.equal(context.state['123'].users.JOINER.voted, false);
assertSingleHost('host');
joiner.send('leaveSession', () => {});
host.send('leaveSession', () => {});
assert(!context.state['123']);
assert(!third.rooms.has('123'));
assert(!third.data.membership);
assert(third.events.some(event => event[0] === 'sessionEnded' && event[1].host === 'HOST'));
third.send('startTask', { taskId: '123', user: 'THIRD' });
assert.equal(context.state['123'].host, 'THIRD');
joiner.send('joinTask', { taskId: '123', user: 'JOINER' });
third.send('disconnect');
assert(!context.state['123']);
assert(!joiner.data.membership);
assert(!joiner.rooms.has('123'));
assert(joiner.events.some(event => event[0] === 'sessionEnded' && event[1].host === 'THIRD'));
host.send('startTask', { taskId: '456', user: 'HOST' });
assert.equal(context.state['456'].host, 'HOST');
host.send('leaveSession', () => {});
assert(!context.state['456']);
console.log('PASS: participant rejoin, vote preservation, host departure closes room, participant notification, host disconnect, task recreation, and sole-host exit');
