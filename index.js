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
      containerQuery: ''
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
    forceUpdateElement(this.state.containerQuery);
  }

  handleSave () {
    // this is left empty on purpose
  }

  async injectContextMenu () {
    const containerClasses = (await getModule([ 'container', 'usernameContainer' ]));
    const containerQuery = `.${containerClasses.container.replace(/ /g, '.')}`;

    const instance = getOwnerInstance(await waitFor(containerQuery));
    inject('pc-mu-avatar', instance.__proto__, 'render', (_, res) => {
      const avatarChildren = (res || res[1]).props.children[0].props.children.props.children();
      const avatar = avatarChildren.props.children.props.children.props;

      if (avatar.size === 'SIZE_32') {
        avatarChildren.props.children.props.onContextMenu = (e) => {
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

      return res;
    });

    this.state.containerQuery = containerQuery;

    if (this.state.containerQuery) {
      forceUpdateElement(this.state.containerQuery);
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
