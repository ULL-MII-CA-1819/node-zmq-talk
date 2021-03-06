'use strict';
const inspect = require("util").inspect;
const ins = (x) => inspect(x, {depth: Math.infinity});
const ic = (x) => console.log(ins(x));


const
  cluster = require('cluster'),
  zmq = require('zeromq'),

  workerCount = require('os').cpus().length,
  externalEndpoint = 'tcp://127.0.0.1:5433',
  workerEndpoint = 'ipc://filer-dealer.ipc';

if (cluster.isMaster) {

  ic(require('os').cpus());
  // Master process - create ROUTER and DEALER sockets, bind endpoints.
  let
    router = zmq.socket('router').bind(externalEndpoint),
    dealer = zmq.socket('dealer').bind(workerEndpoint);

  // Forward messages between router and dealer.
  router.on('message', function(...frames) {
    // let frames = Array.prototype.slice.call(arguments);
    dealer.send(frames);
  });

  dealer.on('message', function(...frames) {
    //let frames = Array.prototype.slice.call(arguments);
    router.send(frames);
  });

  // Listen for workers to come online.
  cluster.on('online', function(worker) {
    console.log('Worker ' + worker.process.pid + ' is online.');
  });

  // Fork worker processes.
  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

} else {

  // Worker process - create REP socket, connect to DEALER.
  let responder = zmq.socket('rep').connect(workerEndpoint);

  responder.on('message', function(data) {

    // Parse incoming message.
    let request = JSON.parse(data);
    console.log('Worker ',cluster.worker.id+' with pid '+process.pid + ' received request from: ' + request.pid);

    // Issue reply.
    responder.send(JSON.stringify({
      id: cluster.worker.id,
      pid: process.pid,
      timestamp: Date.now()
    }));

  });

}
