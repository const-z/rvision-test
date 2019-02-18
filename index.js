const net = require("net");
const readline = require("readline");

const { Client } = require("ssh2");

const cli = require("./cli");
const UserCommand = require("./usercmd");

const sshClient = new Client();
const params = cli();

if (params.R) {
  forwardIn(params.R);
} else if (params.L) {
  forwardOut(params.L);
} else {
  shell(params);
}

function shell({ remoteHost, remotePort, username, password }) {
  sshClient.connect({
    host: remoteHost,
    port: remotePort,
    username,
    password,
  });

  sshClient.on("ready", () => {
    sshClient.shell({ cols: 100, rows: 25 }, (err, stream) => {
      if (err) {
        throw err;
      }
      const userCommand = new UserCommand({ sshClient, shell: stream });
      process.stdin.setRawMode(true);
      readline
        .createInterface({
          input: stream.stdin,
          crlfDelay: Infinity,
          escapeCodeTimeout: Infinity,
          terminal: true,
        })
        .on("line", (line) => {
          userCommand.execute(line);
        })
        .on("SIGINT", () => {});

      process.stdin.pipe(stream.stdout);
      stream.stdout.pipe(process.stdout);
      stream.stderr.pipe(process.stderr);

      stream.on("exit", (exitCode) => {
        process.exit(exitCode);
      });
    });
  });
}

function forwardOut({ localHost, localPort, remoteHost, remotePort, username, password, bindHost, bindPort }) {
  sshClient.connect({
    host: remoteHost,
    port: remotePort,
    username,
    password,
  });

  console.log(`Listening for connections ${localHost}:${localPort}`);

  sshClient.on("ready", () => {
    net
      .createServer(function(sock) {
        sshClient.forwardOut(localHost, localPort, bindHost, bindPort, function(err, stream) {
          if (err) {
            return sock.end();
          }
          stream.pipe(sock).pipe(stream);
        });
      })
      .listen(localPort);
  });
}

function forwardIn({ localHost, localPort, remoteHost, remotePort, username, password }) {
  sshClient.connect({
    host: remoteHost,
    port: remotePort,
    username,
    password,
  });

  sshClient.on("ready", () => {
    sshClient.forwardIn(localHost, localPort, function(err, port) {
      if (err) {
        throw err;
      }
      console.log(`Listening for connections from server on port ${port}`);
    });
    sshClient.on("tcp connection", function(info, accept) {
      console.dir(info);
      const stream = accept();
      // todo pipe streams
      stream
        .on("close", function() {
          console.log("Closed");
        })
        .on("data", function(data) {
          console.log(data);
        })
        .end("\r\n");
    });
  });
}
