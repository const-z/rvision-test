const path = require("path");

const moment = require("moment");

class UserCommand {
  constructor({ sshClient, shell, workDir = "./" }) {
    this.commands = {
      get: "`Downloading from ${from} to ${to}`",
      put: "`Uploading from ${from} to ${to}`",
    };
    this.sshClient = sshClient;
    this.shell = shell;
    this.command = null;
    this.standardPrompt = new RegExp("[>$%#]\\s?");
    this.currentDir = "~";
    this.workDir = workDir;
  }

  execute(line) {
    this.command = null;
    const matches = line.match(this.standardPrompt);

    if (!matches) {
      return;
    }

    this.currentDir = line.slice(line.indexOf(":") + 1, matches.index);
    this.currentDir = this.currentDir === "~" ? this.workDir : this.currentDir;
    const commandLine = line.slice(matches.index + matches[0].length);
    const cmdKey = Object.keys(this.commands).find((key) => commandLine.trim().startsWith(key));

    if (cmdKey) {
      const [name, from, to] = commandLine.trim().split(/\s+/g);
      this.command = {
        key: cmdKey,
        from,
        to,
        prompt: this.commands[cmdKey],
      };

      this.shell.stdout.unpipe();

      this._execute(() => {
        setTimeout(() => {
          this._flush();
          this.shell.stdout.pipe(process.stdout);
          this.shell.stdout.write("\x15");
          this.shell.stdout.write("\x0D");
        }, 1000);
        this.command = null;
      });
    }
  }

  _compileTemplate(s, params) {
    return Function(...Object.keys(params), "return " + s)(...Object.values(params));
  }

  _flush() {
    while (this.shell.stdin.read() !== null) {}
    while (this.shell.stdout.read() !== null) {}
  }

  _normalize(from) {
    const pathFrom = path.normalize([this.currentDir.trim(), from].join("/")).replace(/\\/g, "/");

    return pathFrom;
  }

  _error(err) {
    if (!err) {
      return false;
    }

    process.stderr.write(`[${moment().format("HH:mm:ss")}] ${err}\n`);

    return true;
  }

  _commandGet(from, to, callback) {
    if (!to) {
      const p = path.parse(from);
      to = `${this.workDir}/${p.name}${p.ext}`;
    }

    process.stdout.write(
      `\n[${moment().format("HH:mm:ss")}] ${this._compileTemplate(this.command.prompt, { from, to })}\n`
    );

    this.sshClient.sftp((err, sftp) => {
      if (this._error(err)) {
        sftp.end();

        return callback();
      }
      const pathFrom = this._normalize(from);
      sftp.fastGet(pathFrom, to, {}, (err) => {
        if (this._error(err)) {
          sftp.end();

          return callback();
        }
        process.stdout.write(`[${moment().format("HH:mm:ss")}] ...completed successfully\n`);
        sftp.end();

        callback();
      });
    });
  }

  _commandPut(from, to, callback) {
    if (!to) {
      const p = path.parse(from);
      to = `./${p.name}${p.ext}`;
    }

    process.stdout.write(
      `\n[${moment().format("HH:mm:ss")}] ${this._compileTemplate(this.command.prompt, { from, to })}\n`
    );

    this.sshClient.sftp((err, sftp) => {
      if (this._error(err)) {
        sftp.end();

        return callback();
      }
      sftp.fastPut(from, to, {}, (err) => {
        if (this._error(err)) {
          sftp.end();

          return callback();
        }
        process.stdout.write(`[${moment().format("HH:mm:ss")}] ...completed successfully\n`);
        sftp.end();

        callback();
      });
    });
  }

  _execute(callback) {
    if (!this.command) {
      return callback();
    }

    const { key, ...params } = this.command;

    switch (key) {
      case "get":
        this._commandGet(params.from, params.to, callback);
        break;
      case "put":
        this._commandPut(params.from, params.to, callback);
        break;
    }
  }
}

module.exports = UserCommand;
