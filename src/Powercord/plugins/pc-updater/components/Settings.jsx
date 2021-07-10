const { React, getModule, i18n: { Messages, chosenLocale: currentLocale } } = require('powercord/webpack');
const { Button, FormNotice, FormTitle, Tooltip, Icons: { FontAwesome } } = require('powercord/components');
const { SwitchItem, TextInput, Category, ButtonItem } = require('powercord/components/settings');
const { open: openModal, close: closeModal } = require('powercord/modal');
const { Confirm } = require('powercord/components/modal');
const { REPO_URL, CACHE_FOLDER } = require('powercord/constants');
const { clipboard } = require('electron');
const { readdirSync, existsSync, lstatSync } = require('fs');

const Icons = require('./Icons');
const Update = require('./Update');

module.exports = class UpdaterSettings extends React.PureComponent {
  constructor () {
    super();
    this.plugin = powercord.pluginManager.get('pc-updater');
    this.state = {
      opened: false,
      copied: false
    };
  }

  render () {
    const isUnsupported = window.GLOBAL_ENV.RELEASE_CHANNEL !== 'canary';
    const moment = getModule([ 'momentProperties' ], false);
    // @todo: Make this be in its own store
    const awaitingReload = this.props.getSetting('awaiting_reload', false);
    const updating = this.props.getSetting('updating', false);
    const checking = this.props.getSetting('checking', false);
    const disabled = this.props.getSetting('disabled', false);
    const paused = this.props.getSetting('paused', false);
    const failed = this.props.getSetting('failed', false);

    const updates = this.props.getSetting('updates', []);
    const disabledEntities = this.props.getSetting('entities_disabled', []);
    const checkingProgress = this.props.getSetting('checking_progress', [ 0, 0 ]);
    const last = moment(this.props.getSetting('last_check', false)).calendar();

    let icon,
      title;
    if (disabled) {
      icon = <Icons.Update color='#f04747'/>;
      title = Messages.POWERCORD_UPDATES_DISABLED;
    } else if (paused) {
      icon = <Icons.Paused/>;
      title = Messages.POWERCORD_UPDATES_PAUSED;
    } else if (checking) {
      icon = <Icons.Update color='#7289da' animated/>;
      title = Messages.POWERCORD_UPDATES_CHECKING;
    } else if (updating) {
      icon = <Icons.Update color='#7289da' animated/>;
      title = Messages.POWERCORD_UPDATES_UPDATING;
    } else if (failed) {
      icon = <Icons.Error/>;
      title = Messages.POWERCORD_UPDATES_FAILED;
    } else if (updates.length > 0) {
      icon = <Icons.Update/>;
      title = Messages.POWERCORD_UPDATES_AVAILABLE;
    } else {
      icon = <Icons.UpToDate/>;
      title = Messages.POWERCORD_UPDATES_UP_TO_DATE;
    }

    return <div className='powercord-updater powercord-text'>
      {awaitingReload
        ? this.renderReload()
        : isUnsupported && this.renderUnsupported()}
      <div className='top-section'>
        <div className='icon'>{icon}</div>
        <div className='status'>
          <h3>{title}</h3>
          {!disabled && !updating && (!checking || checkingProgress[1] > 0) && <div>
            {paused
              ? Messages.POWERCORD_UPDATES_PAUSED_RESUME
              : checking
                ? Messages.POWERCORD_UPDATES_CHECKING_STATUS.format({
                  checked: checkingProgress[0],
                  total: checkingProgress[1]
                })
                : Messages.POWERCORD_UPDATES_LAST_CHECKED.format({ date: last })}
          </div>}
        </div>
        <div className="about">
          <div>
            <span>{Messages.POWERCORD_UPDATES_UPSTREAM}</span>
            <span>{powercord.gitInfos.upstream.replace(REPO_URL, Messages.POWERCORD_UPDATES_UPSTREAM_OFFICIAL)}</span>
          </div>
          <div>
            <span>{Messages.POWERCORD_UPDATES_REVISION}</span>
            <span>{powercord.gitInfos.revision.substring(0, 7)}</span>
          </div>
          <div>
            <span>{Messages.POWERCORD_UPDATES_BRANCH}</span>
            <span>{powercord.gitInfos.branch}</span>
          </div>
        </div>
      </div>
      <div className='buttons'>
        {disabled || paused
          ? <Button
            size={Button.Sizes.SMALL}
            color={Button.Colors.GREEN}
            onClick={() => {
              this.props.updateSetting('paused', false);
              this.props.updateSetting('disabled', false);
            }}
          >
            {disabled ? Messages.POWERCORD_UPDATES_ENABLE : Messages.POWERCORD_UPDATES_RESUME}
          </Button>
          : (!checking && !updating && <>
            {updates.length > 0 && <Button
              size={Button.Sizes.SMALL}
              color={failed ? Button.Colors.RED : Button.Colors.GREEN}
              onClick={() => failed ? this.plugin.askForce() : this.plugin.doUpdate()}
            >
              {failed ? Messages.POWERCORD_UPDATES_FORCE : Messages.POWERCORD_UPDATES_UPDATE}
            </Button>}
            <Button
              size={Button.Sizes.SMALL}
              onClick={() => this.plugin.checkForUpdates(true)}
            >
              {Messages.POWERCORD_UPDATES_CHECK}
            </Button>
            <Button
              size={Button.Sizes.SMALL}
              color={Button.Colors.YELLOW}
              onClick={() => this.askPauseUpdates()}
            >
              {Messages.POWERCORD_UPDATES_PAUSE}
            </Button>
            <Button
              size={Button.Sizes.SMALL}
              color={Button.Colors.RED}
              onClick={() => this.askDisableUpdates(true, () => this.props.updateSetting('disabled', true))}
            >
              {Messages.POWERCORD_UPDATES_DISABLE}
            </Button>
          </>)}
      </div>
      {!disabled && !paused && !checking && updates.length > 0 && <div className='updates'>
        {updates.map(update => <Update
          {...update}
          key={update.id}
          updating={updating}
          onSkip={() => this.askSkipUpdate(() => this.plugin.skipUpdate(update.id, update.commits[0].id))}
          onDisable={() => this.askDisableUpdates(false, () => this.plugin.disableUpdates(update))}
        />)}
      </div>}

      {disabledEntities.length > 0 && <Category
        name={Messages.POWERCORD_UPDATES_DISABLED_SECTION}
        opened={this.state.opened}
        onChange={() => this.setState({ opened: !this.state.opened })}
      >
        {disabledEntities.map(entity => <div key={entity.id} className='update'>
          <div className='title'>
            <div className='icon'>
              <Tooltip text={entity.icon} position='left'>
                {React.createElement(Icons[entity.icon])}
              </Tooltip>
            </div>
            <div className='name'>{entity.name}</div>
            <div className='actions'>
              <Button color={Button.Colors.GREEN} onClick={() => this.plugin.enableUpdates(entity.id)}>
                {Messages.POWERCORD_UPDATES_ENABLE}
              </Button>
            </div>
          </div>
        </div>)}
      </Category>}
      <FormTitle className='powercord-updater-ft'>{Messages.OPTIONS}</FormTitle>
      {!disabled && <>
        <SwitchItem
          value={this.props.getSetting('automatic', false)}
          onChange={() => this.props.toggleSetting('automatic')}
          note={Messages.POWERCORD_UPDATES_OPTS_AUTO_DESC}
        >
          {Messages.POWERCORD_UPDATES_OPTS_AUTO}
        </SwitchItem>
        <TextInput
          note={Messages.POWERCORD_UPDATES_OPTS_INTERVAL_DESC}
          onChange={val => this.props.updateSetting('interval', (Number(val) && Number(val) >= 10) ? Math.ceil(Number(val)) : 10, 15)}
          defaultValue={this.props.getSetting('interval', 15)}
          required={true}
        >
          {Messages.POWERCORD_UPDATES_OPTS_INTERVAL}
        </TextInput>
        <TextInput
          note={Messages.POWERCORD_UPDATES_OPTS_CONCURRENCY_DESC}
          onChange={val => this.props.updateSetting('concurrency', (Number(val) && Number(val) >= 1) ? Math.ceil(Number(val)) : 1, 2)}
          defaultValue={this.props.getSetting('concurrency', 2)}
          required={true}
        >
          {Messages.POWERCORD_UPDATES_OPTS_CONCURRENCY}
        </TextInput>
        <ButtonItem
          note={Messages.POWERCORD_UPDATES_OPTS_CHANGE_LOGS_DESC}
          button={Messages.POWERCORD_UPDATES_OPTS_CHANGE_LOGS}
          onClick={() => this.plugin.openChangeLogs()}
        >
          {Messages.POWERCORD_UPDATES_OPTS_CHANGE_LOGS}
        </ButtonItem>
        {/* <ButtonItem
          note={Messages.POWERCORD_UPDATES_OPTS_RELEASE_DESC}
          button={powercord.gitInfos.branch === 'v2'
            ? Messages.POWERCORD_UPDATES_OPTS_RELEASE_DEVELOP_BTN
            : Messages.POWERCORD_UPDATES_OPTS_RELEASE_STABLE_BTN}
          onClick={() => this.askChangeChannel(
            () => this.plugin.changeBranch(powercord.gitInfos.branch === 'v2' ? 'v2-dev' : 'v2')
          )}
        >
          {Messages.POWERCORD_UPDATES_OPTS_RELEASE}
        </ButtonItem> */}

        <Category
          name={Messages.POWERCORD_UPDATES_OPTS_DEBUG}
          description={Messages.POWERCORD_UPDATES_OPTS_DEBUG_DESC}
          opened={this.state.debugInfoOpened}
          onChange={() => this.setState({ debugInfoOpened: !this.state.debugInfoOpened })}
        >
          {this.renderDebugInfo(moment)}
        </Category>
      </>}
    </div>;
  }

  // --- PARTS
  renderReload () {
    const body = <>
      <p>{Messages.POWERCORD_UPDATES_AWAITING_RELOAD_DESC}</p>
      <Button
        size={Button.Sizes.SMALL}
        color={Button.Colors.YELLOW}
        look={Button.Looks.INVERTED}
        onClick={() => location.reload()}
      >
        {Messages.ERRORS_RELOAD}
      </Button>
    </>;
    return this._renderFormNotice(Messages.POWERCORD_UPDATES_AWAITING_RELOAD_TITLE, body);
  }

  renderUnsupported () {
    const body = <p>
      {Messages.POWERCORD_UPDATES_UNSUPPORTED_DESC.format({ releaseChannel: window.GLOBAL_ENV.RELEASE_CHANNEL })}
    </p>;
    return this._renderFormNotice(Messages.POWERCORD_UPDATES_UNSUPPORTED_TITLE, body);
  }

  _renderFormNotice (title, body) {
    return <FormNotice
      imageData={{
        width: 60,
        height: 60,
        src: '/assets/0694f38cb0b10cc3b5b89366a0893768.svg'
      }}
      type={FormNotice.Types.WARNING}
      title={title}
      body={body}
    />;
  }

  // --- PROMPTS
  askSkipUpdate (callback) {
    this._ask(
      Messages.POWERCORD_UPDATES_SKIP_MODAL_TITLE,
      Messages.POWERCORD_UPDATES_SKIP_MODAL,
      Messages.POWERCORD_UPDATES_SKIP,
      callback
    );
  }

  askPauseUpdates () {
    this._ask(
      Messages.POWERCORD_UPDATES_PAUSE,
      Messages.POWERCORD_UPDATES_PAUSE_MODAL,
      Messages.POWERCORD_UPDATES_PAUSE,
      () => this.props.updateSetting('paused', true)
    );
  }

  askDisableUpdates (all, callback) {
    this._ask(
      Messages.POWERCORD_UPDATES_DISABLE,
      all ? Messages.POWERCORD_UPDATES_DISABLE_MODAL_ALL : Messages.POWERCORD_UPDATES_DISABLE_MODAL,
      Messages.POWERCORD_UPDATES_DISABLE,
      callback
    );
  }

  askChangeChannel (callback) {
    this._ask(
      Messages.POWERCORD_UPDATES_OPTS_RELEASE_MODAL_HEADER,
      Messages.POWERCORD_UPDATES_OPTS_RELEASE_MODAL,
      Messages.POWERCORD_UPDATES_OPTS_RELEASE_SWITCH,
      callback
    );
  }

  _ask (title, content, confirm, callback, red = true) {
    openModal(() => <Confirm
      red={red}
      header={title}
      confirmText={confirm}
      cancelText={Messages.CANCEL}
      onConfirm={callback}
      onCancel={closeModal}
    >
      <div className='powercord-text'>{content}</div>
    </Confirm>);
  }

  // --- DEBUG STUFF (Intentionally left english-only)
  renderDebugInfo () {
    const { getRegisteredExperiments, getExperimentOverrides } = getModule([ 'initialize', 'getExperimentOverrides' ], false);
    const { apiManager: { apis }, api: { commands: { commands }, settings: { store: settingsStore } } } = powercord;
    const superProperties = getModule([ 'getSuperPropertiesBase64' ], false).getSuperProperties();
    const unauthorizedPlugins = Array.from(powercord.pluginManager.plugins.values()).filter(plugin =>
      plugin.__shortCircuit).map(plugin => plugin.manifest.name);
    const plugins = powercord.pluginManager.getPlugins().filter(plugin =>
      !powercord.pluginManager.get(plugin).isInternal && powercord.pluginManager.isEnabled(plugin)
    ).map(plugin => `${plugin}@${powercord.pluginManager.get(plugin).manifest.version}`);

    const enabledLabs = powercord.api.labs.experiments.filter(e => powercord.api.labs.isExperimentEnabled(e.id));
    const experimentOverrides = Object.keys(getExperimentOverrides()).length;
    const availableExperiments = Object.keys(getRegisteredExperiments()).length;

    const discordPath = process.resourcesPath.slice(0, -10);
    const maskPath = (path) => {
      path = path.replace(/(?:\/home\/|C:\\Users\\|\/Users\/)([ \w.-]+).*/i, (path, username) => {
        const usernameIndex = path.indexOf(username);
        return [ path.slice(0, usernameIndex), username.charAt(0) + username.slice(1).replace(/[a-zA-Z]/g, '*'),
          path.slice(usernameIndex + username.length) ].join('');
      });

      return path;
    };

    const cachedFiles = (existsSync(CACHE_FOLDER) && readdirSync(CACHE_FOLDER)
      .filter(d => lstatSync(`${CACHE_FOLDER}/${d}`).isDirectory())
      .map(d => readdirSync(`${CACHE_FOLDER}/${d}`))
      .flat().length) || 'n/a';

    const createPathReveal = (title, path) =>
      <div className='full-column'>
        {title}:&#10;<a
          onMouseEnter={() => this.setState({ pathsRevealed: true })}
          onMouseLeave={() => this.setState({ pathsRevealed: false })}
          onClick={() => window.DiscordNative.fileManager.showItemInFolder(path)}
        >{this.state.pathsRevealed ? path : maskPath(path)}</a>
      </div>;

    return <FormNotice
      type={FormNotice.Types.PRIMARY}
      body={<div className={[ 'debug-info', this.state.copied && 'copied' ].filter(Boolean).join(' ')}>
        <code>
          <b>System / Discord </b>
          <div className='row'>
            <div className='column'>Locale:&#10;{currentLocale}</div>
            <div className='column'>OS:&#10;{(window.platform.os).toString()}</div>
            <div className='column'>Architecture:&#10;{superProperties.os_arch}</div>
            {process.platform === 'linux' && (
              <div className='column'>Distro:&#10;{superProperties.distro || 'n/a'}</div>
            )}
            <div className='column'>Release Channel:&#10;{superProperties.release_channel}</div>
            <div className='column'>App Version:&#10;{superProperties.client_version}</div>
            <div className='column'>Build Number:&#10;{superProperties.client_build_number}</div>
            <div className='column'>Build ID:&#10;{window.GLOBAL_ENV.SENTRY_TAGS.buildId}</div>
            <div className='column'>Experiments:&#10;{experimentOverrides} / {availableExperiments}</div>
          </div>

          <b>Process Versions </b>
          <div className='row'>
            <div className='column'>React:&#10;{React.version}</div>
            {[ 'electron', 'chrome', 'node' ].map(proc =>
              <div className='column'>{proc.charAt(0).toUpperCase() + proc.slice(1)}:&#10;{process.versions[proc]}</div>
            )}
          </div>

          <b>Powercord </b>
          <div className='row'>
            <div className='column'>Commands:&#10;{Object.keys(commands).length}</div>
            <div className='column'>Settings:&#10;{Object.keys(settingsStore.getAllSettings()).length}</div>
            <div className='column'>Plugins:&#10;{powercord.pluginManager.getPlugins()
              .filter(plugin => powercord.pluginManager.isEnabled(plugin)).length} / {powercord.pluginManager.plugins.size}
            </div>
            <div className='column'>Themes:&#10;{powercord.styleManager.getThemes()
              .filter(theme => powercord.styleManager.isEnabled(theme)).length} / {powercord.styleManager.themes.size}
            </div>
            <div className='column'>Labs:&#10;{enabledLabs.length} / {powercord.api.labs.experiments.length}
            </div>
            <div className='column'>{`Settings Sync:\n${powercord.settings.get('settingsSync', false)}`}</div>
            <div className='column'>Cached Files:&#10;{cachedFiles}</div>
            <div className='column'>{`Account:\n${!!powercord.account}`}</div>
            <div className='column'>APIs:&#10;{apis.length}</div>
          </div>

          <b>Git </b>
          <div className='row'>
            <div className='column'>Upstream:&#10;{powercord.gitInfos.upstream.replace(REPO_URL, 'Official')}</div>
            <div className='column'>Revision:&#10;
              <a
                href={`https://github.com/${powercord.gitInfos.upstream}/commit/${powercord.gitInfos.revision}`}
                target='_blank'
              >
                [{powercord.gitInfos.revision.substring(0, 7)}]
              </a>
            </div>
            <div className='column'>Branch:&#10;{powercord.gitInfos.branch}</div>
            <div className='column'>{`Latest:\n${!this.props.getSetting('updates', []).find(update => update.id === 'powercord')}`}</div>
          </div>

          <b>Listings </b>
          <div className='row'>
            {createPathReveal('Powercord Path', powercord.basePath)}
            {createPathReveal('Discord Path', discordPath)}
            <div className='full-column'>Experiments:&#10;{experimentOverrides > 0 ? Object.keys(getExperimentOverrides()).join(', ') : 'n/a'}</div>
            <div className='full-column'>Labs:&#10;
              {enabledLabs.length ? enabledLabs.map(e => e.name).join(', ') : 'n/a'}
            </div>
            <div className='full-column'>
              Plugins:&#10;
              {(plugins.length > 6 ? `${(this.state.pluginsRevealed ? plugins : plugins.slice(0, 6)).join(', ')};` : plugins.join(', ')) || 'n/a'}&nbsp;
              {plugins.length > 6 &&
              <a onClick={() => this.setState({ pluginsRevealed: !this.state.pluginsRevealed })}>
                {this.state.pluginsRevealed ? 'Show less' : 'Show more'}
              </a>}
            </div>
            {unauthorizedPlugins.length > 0 && <div className='full-column'>
              Unauthorized Plugins:&#10;
              {unauthorizedPlugins.join(', ')}
            </div>}
            {window.bdplugins && <div className='full-column'>
              BetterDiscord Plugins:&#10;
              {Object.keys(window.bdplugins).join(', ')}
            </div>}
          </div>
        </code>
        <Button
          size={Button.Sizes.SMALL}
          color={this.state.copied ? Button.Colors.GREEN : Button.Colors.BRAND}
          onClick={() => this.handleDebugInfoCopy(plugins)}
        >
          <FontAwesome icon={this.state.copied ? 'clipboard-check' : 'clipboard'}/> {this.state.copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>}
    />;
  }

  handleDebugInfoCopy (plugins) {
    const extract = document.querySelector('.debug-info > code')
      .innerText.replace(/([A-Z/ ]+) (?=\s(?!C:\\).*?:)/g, '\n[$1]').replace(/(.*?):\s(.*.+)/g, '$1="$2"').replace(/[ -](\w*(?=.*=))/g, '$1');

    this.setState({ copied: true });
    clipboard.writeText(
      `\`\`\`ini
      # Debugging Information | Result created: ${new Date().toUTCString()}
      ${extract.substring(0, extract.indexOf('\nPlugins', extract.indexOf('\nPlugins') + 1))}
      Plugins="${plugins.join(', ')}"${window.bdplugins ? `\nBDPlugins="${Object.keys(window.bdplugins).join(', ')}"` : ''}
      \`\`\``.replace(/ {6}|n\/a/g, '').replace(/(?![0-9]{1,3}) \/ (?=[0-9]{1,3})/g, '/')
    );
    setTimeout(() => this.setState({ copied: false }), 2500);
  }
};
