const { existsSync, lstatSync } = require('fs');
const { React, getModule } = require('powercord/webpack');
const { SwitchItem, TextInput, Category } = require('powercord/components/settings');

let getGuild, getFlattenedGuilds;

module.exports = class EmojiUtilitySettings extends React.Component {
  constructor (props) {
    super(props);

    if (getGuild && getFlattenedGuilds) {
      this._setState(false);
    }
  }

  _setState (update = true) {
    const state = {
      isFilePathValid: this.props.getSetting('filePath') ? existsSync(this.props.getSetting('filePath')) : true,
      initialFilePathValue: this.props.getSetting('filePath'),

      isCloneIdValid: this.props.getSetting('defaultCloneId') ? !!getGuild(this.props.getSetting('defaultCloneId')) : true,
      initialCloneIdValue: this.props.getSetting('defaultCloneId')
    };

    if (update) {
      this.setState(state);
    } else {
      this.state = state;
    }
  }

  async componentDidMount () {
    if (!(getGuild && getFlattenedGuilds)) {
      ({ getGuild } = await getModule([ 'getGuild' ]));
      ({ getFlattenedGuilds } = await getModule([ 'getFlattenedGuilds' ]));

      this._setState();
    }
  }

  render () {
    if (!(getGuild && getFlattenedGuilds)) {
      return null;
    }

    return (
      <div>
        <SwitchItem
          note='Whether Emote Utility should return responses in embeds.'
          value={this.props.getSetting('useEmbeds')}
          onChange={() => this.props.toggleSetting('useEmbeds')}
        >
          Use embeds
        </SwitchItem>

        {!this.props.getSetting('useEmbeds') && (
          <SwitchItem
            note='Whether the message for the findemote command should contain the link to the guild the emote is in.'
            value={this.props.getSetting('displayLink')}
            onChange={() => this.props.toggleSetting('displayLink')}
          >
            Display link
          </SwitchItem>
        )}

        <TextInput
          note='The directory emotes will be saved to.'
          defaultValue={this.props.getSetting('filePath')}
          style={!this.state.isFilePathValid ? { borderColor: 'red' } : {}}
          onChange={(value) => {
            if (value.length === 0 || (existsSync(value) && lstatSync(value).isDirectory())) {
              this.setState({
                isFilePathValid: true
              });

              this.props.updateSetting('filePath', value.length === 0 ? null : value);
            } else {
              this.setState({
                isFilePathValid: false
              });

              this.props.updateSetting('filePath', this.state.initialFilePathValue);
            }
          }}
        >
          Save directory
        </TextInput>

        <SwitchItem
          note='Whether a separate folder should be created when downloading emotes with the --server flag.'
          value={this.props.getSetting('createGuildFolders')}
          onChange={() => this.props.toggleSetting('createGuildFolders')}
        >
          Create separate folder when exporting with --server flag
        </SwitchItem>

        <SwitchItem
          note='Whether saving emotes should contain the id of the emote, this prevents overwriting old saved emotes.'
          value={this.props.getSetting('includeIdForSavedEmojis')}
          onChange={() => this.props.toggleSetting('includeIdForSavedEmojis')}
        >
          Include ID when saving emotes
        </SwitchItem>

        <SwitchItem
          note='Whether the default server for cloning emotes should be the server you are currently in.'
          value={this.props.getSetting('defaultCloneIdUseCurrent')}
          onChange={() => this.props.toggleSetting('defaultCloneIdUseCurrent')}
        >
          Use current server when cloning emotes
        </SwitchItem>

        {!this.props.getSetting('defaultCloneIdUseCurrent') && (
          <TextInput
            note='The default server id which will be used to save cloned emotes.'
            defaultValue={this.props.getSetting('defaultCloneId')}
            style={!this.state.isCloneIdValid ? { borderColor: 'red' } : {}}
            onChange={(value) => {
              if (value.length === 0 || getGuild(value)) {
                this.setState({
                  isCloneIdValid: true
                });

                this.props.updateSetting('defaultCloneId', value.length === 0 ? null : value);
              } else {
                this.setState({
                  isCloneIdValid: false
                });

                this.props.updateSetting('defaultCloneId', this.state.initialCloneIdValue);
              }
            }}
          >
            Default server ID when cloning emotes
          </TextInput>
        )}

        <Category
          name='Hide emotes'
          description={'Hide emotes from some servers. They won\'t show up in emote picker, except in searches.'}
          opened={this.state.categoryOpened}
          onChange={() => this.setState({ categoryOpened: !this.state.categoryOpened })}
        >
          {getFlattenedGuilds().map(g => <SwitchItem
            value={this.props.getSetting('hiddenGuilds', []).includes(g.id)}
            onChange={() => this._handleGuildToggle(g.id)}
          >
            Hide emojis from {g.name}
          </SwitchItem>)}
        </Category>
      </div>
    );
  }

  _handleGuildToggle (id) {
    const hiddenGuilds = this.props.getSetting('hiddenGuilds', []);

    if (!hiddenGuilds.includes(id)) {
      this.props.updateSetting('hiddenGuilds', [ ...hiddenGuilds, id ]);
    } else {
      this.props.updateSetting('hiddenGuilds', hiddenGuilds.filter(g => g !== id));
    }
  }
};
