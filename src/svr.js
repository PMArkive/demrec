let fs = require('fs')
let child = require('child_process')
let ph = require('path')
let util = require('./util')

function SVR () {}

SVR.prototype.init = function (dir) {
  if (fs.existsSync(dir)) {
    this.path = ph.resolve(dir)
    this.exe = ph.join(this.path, 'svr_launcher.exe')
    this.movies = ph.join(this.path, 'movies')
    this.profiles = ph.join(this.path, 'data', 'profiles')
    this.log = ph.join(this.path, 'data', 'SVR_LOG.txt')
    return true
  }
  return false
}

SVR.prototype.writeProfile = function (name, cfg) {
  let res = []
  for (let key in cfg) { for (let prop in cfg[key]) { res.push(`${key}_${prop}=${cfg[key][prop]}`) } }
  fs.writeFileSync(ph.join(this.path, 'data', 'profiles', name + '.ini'), `${res.join('\n')}\n`)
}

SVR.prototype.run = async function (game, events) {
  let proc = await util.findProcess(x => x.name === ph.basename(game.exe) && x.cmd.indexOf(game.token) !== -1)
  if (proc) throw new Error(`An SVR instance is already running! [${proc.id}]`)

  let svr = child.exec(`"${this.exe}" ${game.id} ${game.params}`.trim())

  svr.on('error', e => { throw e })

  await new Promise(resolve => {
    svr.stdout.on('data', d => {
      let parts = d.toString().trim().split(' ')
      switch (parts[0]) {
        case 'HELLO': {
          events.hello()
          break
        }
        case 'INIT': {
          events.init()
          resolve()
          break
        }
        case 'EXIT': {
          events.exit(Number(parts[1]))
          break
        }
      }
    })
  })

  let app = await util.findProcess(x => x.path.toLowerCase() === game.exe.toLowerCase())

  svr.send = cmd => child.spawn(game.exe, ['-hijack', ...cmd])
  svr.exit = () => {
    try { process.kill(app.id) } catch (e) { return false }
    svr = null
  }

  return svr
}

module.exports = new SVR()
