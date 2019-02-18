const meow = require("meow");

const cliFlags = {
  booleanDefault: undefined,
  autoHelp: true,
  flags: {
    R: {
      type: "string",
    },
    L: {
      type: "string",
    },
  },
};

function cli() {
  const cli = meow(
    `
      Usage
        $ node index.js <username>:<password>@<ssh_host>:<ssh_port> [[-R host:hostport] | [-L[bind_address:]port:host:hostport]]

      Options
        -R  forward port from remote to local
        -L  forward port from local to remote

      Examples
        $ node index.js root:pxtm0222@10.8.0.22:22 -L 3001:localhost:3000
  `,
    cliFlags
  );

  if (!cli.input[0]) {
    cli.showHelp();
  }

  let params = null;

  try {
    const connectionParams = cli.input[0].split("@");
    const [username, password] = connectionParams[0].split(":");
    const [remoteHost, remotePort] = connectionParams[1].split(":");

    params = {
      username,
      password,
      remoteHost,
      remotePort: remotePort || 22,
    };

    if (Object.keys(cli.flags).includes("R")) {
      let [host, port] = cli.flags.R.split(":");
      if (!port) {
        port = host;
        host = "127.0.0.1";
      }
      params.R = {
        localHost: host,
        localPort: port,
        ...params,
      };
    } else if (Object.keys(cli.flags).includes("L")) {
      let [localHost, localPort, bindHost, bindPort] = cli.flags.L.split(":");
      if (!bindPort) {
        bindPort = bindHost;
        bindHost = localPort;
        localPort = localHost;
        localHost = "127.0.0.1";
      }
      params.L = {
        localHost,
        localPort,
        bindHost,
        bindPort,
        ...params,
      };
    }
  } catch (err) {
    cli.showHelp();
    process.exit(1);
  }

  return params;
}

module.exports = cli;
