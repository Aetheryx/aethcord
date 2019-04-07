const { React } = require('powercord/webpack');
const { TextInput, SwitchItem } = require('powercord/components/settings');

module.exports = class HastebinSettings extends React.Component {
  constructor (props) {
    super();

    this.settings = props.settings;
    this.state = {
      domain: props.settings.get('domain', 'https://haste.aetheryx.xyz'),
      send: props.settings.get('send', false)
    };
  }

  render () {
    const settings = this.state;

    const set = (key, value = !settings[key], defaultValue) => {
      if (!value && defaultValue) {
        value = defaultValue;
      }

      this.settings.set(key, value);
      this.setState({
        [key]: value
      });
    };

    return (
      <div>
        <TextInput
          note='The domain used for the Hastebin server.'
          defaultValue={settings.domain}
          required={true}
          onChange={val => set('domain', val.endsWith('/') ? val.slice(0, -1) : val)}
        >
          Domain
        </TextInput>
        <SwitchItem
            note='Whether the Hastebin link is sent in chat by default or not.'
            value={settings.send}
            onChange={() => set('send')}
          >
            Send Link
        </SwitchItem>
      </div>
    );
  }
};
