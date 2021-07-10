const { React, getModule, i18n: { Messages } } = require('powercord/webpack');
const { Icons: { FontAwesome } } = require('powercord/components');
const { open: openModal, close: closeModal } = require('powercord/modal');
const { TextInput, SwitchItem, ButtonItem, Category } = require('powercord/components/settings');
const { Confirm } = require('powercord/components/modal');
const { WEBSITE, CACHE_FOLDER } = require('powercord/constants');
const { rmdirRf } = require('powercord/util');

const PassphraseModal = require('./PassphraseModal.jsx');
const Account = require('./PowercordAccount');

module.exports = class GeneralSettings extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      discordCleared: false,
      powercordCleared: false
    };
  }

  render () {
    const { getSetting, toggleSetting, updateSetting } = this.props;

    return (
      <div>
        <Account
          passphrase={this.passphrase.bind(this)}
          onAccount={() => this.forceUpdate()}
        />
        <TextInput
          defaultValue={getSetting('prefix', '.')}
          onChange={p => updateSetting('prefix', !p ? '.' : p.replace(/\s+(?=\S)|(?<=\s)\s+/g, '').toLowerCase())}
          onBlur={({ target }) => target.value = getSetting('prefix', '.')}
          error={getSetting('prefix', '.') === '/' ? 'Prefix should not be set to `/` as it is already in use by Discord and may disable Powercord autocompletions.' : ''}
        >
          {Messages.POWERCORD_COMMAND_PREFIX}
        </TextInput>
        <SwitchItem note={'Settings sync is currently not available.'} disabled>
          {Messages.POWERCORD_SETTINGS_SYNC}
        </SwitchItem>
        <SwitchItem
          note={Messages.POWERCORD_SETTINGS_NO_CLYDE_DESC.format({ discordiaUrl: 'https://discordia.me/clyde' })}
          value={getSetting('replaceClyde', true)}
          onChange={() => toggleSetting('replaceClyde', true)}
        >
          {Messages.POWERCORD_SETTINGS_NO_CLYDE}&ensp;<FontAwesome icon='robot'/>
        </SwitchItem>

        <Category
          name={Messages.ADVANCED_SETTINGS}
          description={Messages.POWERCORD_SETTINGS_ADVANCED_DESC}
          opened={getSetting('advancedSettings', false)}
          onChange={() => toggleSetting('advancedSettings')}
        >
          <SwitchItem
            note={Messages.POWERCORD_SETTINGS_DEBUG_LOGS_DESC}
            value={getSetting('debugLogs', false)}
            onChange={() => {
              toggleSetting('debugLogs');
              this.askRestart();
            }}
          >
            {Messages.POWERCORD_SETTINGS_DEBUG_LOGS}
          </SwitchItem>
          {powercord.api.labs.isExperimentEnabled('pc-sdk')
            ? <SwitchItem
              note={'Powercord\'s SDK is a toolkit made to make plugin and theme developer\'s life easier. Once enabled, you can access it through the icon at the top right hand corner of Discord.'}
              value={getSetting('sdkEnabled', false)}
              onChange={() => toggleSetting('sdkEnabled')}
            >
              Enable Powercord SDK
            </SwitchItem>
            : <SwitchItem
              note={Messages.POWERCORD_SETTINGS_OVERLAY_DESC}
              value={getSetting('openOverlayDevTools', false)}
              onChange={() => toggleSetting('openOverlayDevTools')}
            >
              {Messages.POWERCORD_SETTINGS_OVERLAY}
            </SwitchItem>}
          <SwitchItem
            note={Messages.POWERCORD_SETTINGS_KEEP_TOKEN_DESC}
            value={getSetting('hideToken', true)}
            onChange={() => toggleSetting('hideToken', true)}
          >
            {Messages.POWERCORD_SETTINGS_KEEP_TOKEN}
          </SwitchItem>
          <SwitchItem
            disabled={!!window.GlasscordApi}
            note={window.GlasscordApi
              ? Messages.POWERCORD_SETTINGS_TRANSPARENT_GLASSCORD.format({ glasscordCfgUrl: 'https://github.com/AryToNeX/Glasscord#how-do-i-use-it' })
              : Messages.POWERCORD_SETTINGS_TRANSPARENT_DESC.format()}
            value={getSetting('transparentWindow', false)}
            onChange={() => {
              toggleSetting('transparentWindow');
              this.askRestart();
            }}
          >
            {Messages.POWERCORD_SETTINGS_TRANSPARENT}
          </SwitchItem>
          <SwitchItem
            note={Messages.POWERCORD_SETTINGS_FRAME_DESC}
            value={getSetting('windowFrame', true)}
            onChange={() => {
              toggleSetting('windowFrame');
              this.askRestart();
            }}
          >
            {Messages.POWERCORD_SETTINGS_FRAME}
          </SwitchItem>
          <SwitchItem
            note={Messages.POWERCORD_SETTINGS_EXP_WEB_PLATFORM_DESC.format()}
            value={getSetting('experimentalWebPlatform', false)}
            onChange={() => {
              toggleSetting('experimentalWebPlatform');
              this.askRestart();
            }}
          >
            {Messages.POWERCORD_SETTINGS_EXP_WEB_PLATFORM}
          </SwitchItem>
          <SwitchItem
            note={Messages.POWERCORD_SETTINGS_DISCORD_EXPERIMENTS_DESC.format()}
            value={getSetting('experiments', false)}
            onChange={async () => {
              toggleSetting('experiments');
              // Update modules
              const experimentsModule = await getModule(r => r.isDeveloper !== void 0);
              experimentsModule._changeCallbacks.forEach(cb => cb());
            }}
          >
            {Messages.POWERCORD_SETTINGS_DISCORD_EXPERIMENTS}
          </SwitchItem>
          <TextInput
            value={getSetting('backendURL', WEBSITE)}
            onChange={p => updateSetting('backendURL', !p ? WEBSITE : p)}
            note={Messages.POWERCORD_SETTINGS_BACKEND_DESC}
          >
            {Messages.POWERCORD_SETTINGS_BACKEND}
          </TextInput>
        </Category>
        <ButtonItem
          note={Messages.POWERCORD_SETTINGS_CACHE_POWERCORD_DESC}
          button={this.state.powercordCleared ? Messages.POWERCORD_SETTINGS_CACHE_CLEARED : Messages.POWERCORD_SETTINGS_CACHE_POWERCORD}
          success={this.state.powercordCleared}
          onClick={() => this.clearPowercordCache()}
        >
          {Messages.POWERCORD_SETTINGS_CACHE_POWERCORD}
        </ButtonItem>
        <ButtonItem
          note={Messages.POWERCORD_SETTINGS_CACHE_DISCORD_DESC}
          button={this.state.discordCleared ? Messages.POWERCORD_SETTINGS_CACHE_CLEARED : Messages.POWERCORD_SETTINGS_CACHE_DISCORD}
          success={this.state.discordCleared}
          onClick={() => this.clearDiscordCache()}
        >
          {Messages.POWERCORD_SETTINGS_CACHE_DISCORD}
        </ButtonItem>
      </div>
    );
  }

  passphrase (updateSync = false) {
    openModal(() => <PassphraseModal
      onConfirm={(passphrase) => {
        this.props.updateSetting('passphrase', passphrase);
        closeModal();
        if (updateSync) {
          this.props.toggleSetting('settingsSync');
        }
      }}
      onCancel={closeModal}
    />);
  }

  clearDiscordCache () {
    this.setState({ discordCleared: true });
    PowercordNative.clearCache().then(() => {
      setTimeout(() => {
        this.setState({ discordCleared: false });
      }, 2500);
    });
  }

  clearPowercordCache () {
    this.setState({ powercordCleared: true });
    rmdirRf(CACHE_FOLDER).then(() => {
      setTimeout(() => {
        this.setState({ powercordCleared: false });
      }, 2500);
    });
  }

  askRestart () {
    openModal(() => <Confirm
      red
      header={Messages.ERRORS_RESTART_APP}
      confirmText={Messages.BUNDLE_READY_RESTART}
      cancelText={Messages.BUNDLE_READY_LATER}
      onConfirm={() => DiscordNative.app.relaunch()}
      onCancel={closeModal}
    >
      <div className='powercord-text'>
        {Messages.POWERCORD_SETTINGS_RESTART}
      </div>
    </Confirm>);
  }
};
