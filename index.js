const { Plugin } = require('powercord/entities');
const { React, getModule, contextMenu } = require('powercord/webpack');
const { forceUpdateElement, getOwnerInstance, waitFor } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { ContextMenu } = require('powercord/components');

const Settings = require('./core/components/Settings');

module.exports = class Mu extends Plugin {
  constructor (props) {
    super(props);

    this.state = {
      avatarQuery: ''
    }
  }

  async startPlugin () {
    this.loadCSS(require('path').resolve(__dirname, 'core/styles/style.scss'));
    this.registerSettings('mu', 'Mu', (props) => React.createElement(Settings, {
      ...props,
      saveHandler: this.handleSave.bind(this)
    }));

    this.injectContextMenu();
  }

  pluginWillUnload () {
    uninject('pc-mu-avatar');
    forceUpdateElement(this.state.avatarQuery);
  }

  handleSave () {
    // this is left empty on purpose
  }

  async injectContextMenu () {
    const currentUserId = (await getModule([ 'getId' ])).getId();

    const avatarClasses = (await getModule([ 'container', 'usernameContainer' ]));
    const avatarQuery = `.${avatarClasses.avatar.replace(/ /g, '.')}`;

    const instance = getOwnerInstance(await waitFor(avatarQuery));
    inject('pc-mu-avatar', instance.__proto__, 'render', (_, res) => {
      if (res.props && res.props.children && res.props.children.props) {
        const avatar = res.props.children.props;
        const avatarUserId = avatar.src ? (new URL(avatar.src).pathname).split('/')[2] : null;

        if (avatarUserId === currentUserId && avatar.size === 'SIZE_32') {
          res.props.onContextMenu = (e) => {
            const { pageX, pageY } = e;
            const users = this.settings.get('users', []);

            contextMenu.openContextMenu(e, () =>
              React.createElement(ContextMenu, {
                pageX,
                pageY,
                itemGroups: [
                  users.map(u => ({
                    type: 'button',
                    name: `Open ${u.nickname || 'Untitled'}`,
                    onClick: () => this.createNewInstance(u.token)
                  }))
                ]
              })
            );
          };
        }
      }

      return res;
    });

    this.state.avatarQuery = avatarQuery;

    if (this.state.avatarQuery) {
      forceUpdateElement(this.state.avatarQuery);
    }
  }

  createNewInstance (token) {
    const { remote } = require('electron');
    const { remote: { BrowserWindow } } = require('electron');

    const route = `https:${GLOBAL_ENV.WEBAPP_ENDPOINT}/channels/@me`;
    const opts = {
      ...BrowserWindow.getFocusedWindow().webContents.browserWindowOptions,
      token
    };

    delete opts.show;
    delete opts.x;
    delete opts.y;

    opts.webPreferences.preload = `${__dirname}/core/preload.js`;

    const window = new BrowserWindow(opts);
    window.webContents.once('did-finish-load', () => {
      remote.getCurrentWindow().webContents.executeJavaScript('localStorage.removeItem("token")');
      window.webContents.executeJavaScript('localStorage.removeItem("token")');
    });

    window.on('close', () => window.destroy());
    window.loadURL(route);
  }
};
