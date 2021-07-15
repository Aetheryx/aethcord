const { Plugin } = require('powercord/entities');

const {
  getModule,
  React,
  /* contextMenu, */
  constants: {
    Routes,
    Permissions,
    APP_URL_PREFIX,
    EMOJI_RE,
    EMOJI_MAX_LENGTH
  }
} = require('powercord/webpack');

/* const { CDN_HOST } = window.GLOBAL_ENV; */

const { ContextMenu } = require('powercord/components');
const { getOwnerInstance } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { open: openModal } = require('powercord/modal');

const { writeFile } = require('fs').promises;
const { existsSync, mkdirSync } = require('fs');

const { get } = require('powercord/http');
const { extname, resolve, join } = require('path');
const { parse } = require('url');

const { clipboard } = require('electron');

const Settings = require('./components/Settings.jsx');
const EmojiNameModal = require('./components/EmojiNameModal.jsx');

const colors = {
  error: 0xdd2d2d,
  success: 0x1bbb1b
};

module.exports = class EmojiUtility extends Plugin {
  async import (filter, functionName = filter) {
    if (typeof filter === 'string') {
      filter = [ filter ];
    }

    this[functionName] = (await getModule(filter))[functionName];
  }

  async doImport () {
    this.emojiStore = await getModule([ 'getGuildEmoji' ]);

    await this.import('getGuild');
    await this.import('getGuilds');
    await this.import('getFlattenedGuilds');
    await this.import('uploadEmoji');
    await this.import('getChannel');
    await this.import('getGuildPermissions');
    await this.import('transitionTo');
    await this.import('getCurrentUser');
    await this.import('createBotMessage');
    await this.import('receiveMessage');
    await this.import('getSelectedChannelState');
    await this.import([ 'getLastSelectedChannelId' ], 'getChannelId');
    await this.import('queryEmojiResults');
  }

  getEmojiRegex () {
    return /^<a?:([a-zA-Z0-9_]+):([0-9]+)>$/;
  }

  getEmojiUrlRegex () {
    return /https:\/\/cdn.discordapp.com\/emojis\/(\d+)/;
  }

  getGuildRoute (guildId) {
    const selectedChannelId = this.getSelectedChannelState()[guildId];

    /* eslint-disable new-cap */
    return selectedChannelId
      ? Routes.CHANNEL(guildId, selectedChannelId)
      : Routes.GUILD(guildId);
    /* eslint-enable new-cap */
  }

  getGuildUrl (guildId) {
    return APP_URL_PREFIX + this.getGuildRoute(guildId);
  }

  getFullEmoji (emoji) {
    return `<${(emoji.animated ? 'a' : '')}:${emoji.name}:${emoji.id}>`;
  }

  sendBotMessage (content) {
    const receivedMessage = this.createBotMessage(this.getChannelId(), '');

    if (typeof content === 'string') {
      receivedMessage.content = content;
    } else {
      receivedMessage.embeds.push(content);
    }

    return this.receiveMessage(receivedMessage.channel_id, receivedMessage);
  }

  reply (content, embed) {
    this.sendBotMessage(
      this.settings.get('useEmbeds')
        ? Object.assign({
          type: 'rich',
          description: content
        }, embed)
        : content
    );
  }

  replySuccess (content, embed) {
    this.reply(content, Object.assign({ color: colors.success }, embed));
  }

  replyError (content, embed) {
    this.reply(content, Object.assign({ color: colors.error }, embed));
  }

  getExtension (url) {
    return extname(parse(url).pathname).substring(1);
  }

  async getImageEncoded (imageUrl) {
    const extension = this.getExtension(imageUrl);
    const { raw } = await get(imageUrl);

    return `data:image/${extension};base64,${raw.toString('base64')}`;
  }

  getGuildByIdOrName (input) {
    let guild = this.getGuild(input);
    if (!guild) {
      input = input.toLowerCase();

      guild = Object.values(this.getGuilds()).find(g => g.name.toLowerCase().includes(input));
    }

    return guild;
  }

  findEmojisForCommand (args) {
    args = [ ...new Set(args) ];

    if (args.length === 0) {
      return this.replyError('Please provide an emote');
    }

    const emojis = Object.values(this.emojiStore.getGuilds()).flatMap(g => g.emojis);

    const foundEmojis = [];
    const notFoundEmojis = [];

    for (const argument of args) {
      const matcher = argument.match(this.getEmojiRegex());
      if (matcher) {
        const emoji = emojis.find(e => e.id === matcher[2]);

        if (emoji) {
          emoji.guild = this.getGuild(emoji.guildId);

          foundEmojis.push(emoji);

          continue;
        }

        if (args.length === 1) {
          return this.replyError(`Could not find emote ${argument}`);
        }
      }

      if (args.length === 1) {
        return this.replyError(`**${argument}** is not a custom emote`);
      }

      notFoundEmojis.push(argument);
    }

    return {
      foundEmojis,
      notFoundEmojis
    };
  }

  hasPermission (guildId, permission) {
    const permissions = this.getGuildPermissions(guildId);

    return permissions && (permissions & permission) !== 0;
  }

  createFakeEmoji (id, name, url) {
    return {
      id,
      name,
      url,
      animated: this.getExtension(url) === 'gif',
      fake: true
    };
  }

  getEmojis (guildId, animated = null) {
    return this.emojiStore.getGuilds()[guildId].emojis.filter(e => animated === null || e.animated === animated);
  }

  getEmojiById (id) {
    return Object.values(this.emojiStore.getGuilds()).flatMap(g => g.emojis).find(e => e.id === id);
  }

  getHiddenGuilds () {
    return this.settings.get('hiddenGuilds', []);
  }

  getMaxEmojiSlots (guildId) {
    return this.getGuild(guildId).getMaxEmojiSlots();
  }

  async startPlugin () {
    await this.doImport();
    this.loadStylesheet('style.scss');

    /* Default settings */
    this.settings.set('useEmbeds', this.settings.get('useEmbeds', false));
    this.settings.set('displayLink', this.settings.get('displayLink', true));
    this.settings.set('createGuildFolder', this.settings.get('createGuildFolder', true));
    this.settings.set('includeIdForSavedEmojis', this.settings.get('includeIdForSavedEmojis', true));
    this.settings.set('defaultCloneIdUseCurrent', this.settings.get('defaultCloneIdUseCurrent', false));

    const getCloneableFeatures = (emoji) => {
      const onGuildClick = async (guild) => {
        if (!guild) {
          if (this.settings.get('defaultCloneIdUseCurrent')) {
            guild = this.getGuild(this.getChannel(this.getChannelId()).guild_id);
          } else if (this.settings.get('defaultCloneId')) {
            guild = this.getGuild(this.settings.get('defaultCloneId'));
            if (!guild) {
              return this.replyError('You are no longer in your default server, please update your settings');
            }
          }

          if (guild) {
            if (!this.hasPermission(guild.id, Permissions.MANAGE_EMOJIS)) {
              return this.replyError(`Missing permissions to upload emotes in **${guild.name}**`);
            }
          } else {
            return this.replyError('You do not have a default server, please update your settings');
          }
        }

        if (this.getEmojis(guild.id, emoji.animated).length >= this.getMaxEmojiSlots(guild.id)) {
          return this.replyError(`**${guild.name}** does not have any more emote slots`);
        }

        try {
          await this.uploadEmoji(guild.id, await this.getImageEncoded(emoji.url), emoji.name);

          this.replySuccess(`Cloned emote ${this.getFullEmoji(emoji)} to **${guild.name}**`);
        } catch (error) {
          console.error(error);

          if (error.body && error.body.message) {
            this.replyError(error.body.message);
          } else {
            this.replyError('Failed to clone emote, check the console for more information', {
              description: 'Failed to clone emote',
              footer: {
                text: 'Check the console for more information'
              }
            });
          }
        }
      };

      const getCloneableGuilds = () => {
        const items = [];
        const clonableGuilds = Object.values(this.getFlattenedGuilds()).filter(guild => this.hasPermission(guild.id, Permissions.MANAGE_EMOJIS));

        for (const guild of clonableGuilds) {
          items.push({
            type: 'button',
            name: guild.name,
            onClick: () => onGuildClick(guild)
          });
        }

        return items;
      };

      const features = [];

      features.push({
        type: 'submenu',
        name: 'Clone',
        hint: 'to',
        onClick: () => onGuildClick(null),
        getItems: getCloneableGuilds
      });

      features.push({
        type: 'button',
        name: 'Save',
        onClick: async () => {
          if (!this.settings.get('filePath')) {
            this.replyError('Please set your save directory in the settings');

            return;
          }

          if (!existsSync(this.settings.get('filePath'))) {
            this.replyError('The specified save directory does no longer exist, please update it in the settings');

            return;
          }

          try {
            const name = this.settings.get('includeIdForSavedEmojis') ? `${emoji.name} (${emoji.id})` : emoji.name;

            await writeFile(resolve(this.settings.get('filePath'), name + extname(parse(emoji.url).pathname)), (await get(emoji.url)).raw);

            this.replySuccess(`Downloaded ${this.getFullEmoji(emoji)}`);
          } catch (error) {
            console.error(error);

            this.replyError(`Failed to download ${this.getFullEmoji(emoji)}, check the console for more information`, {
              description: `Failed to download ${this.getFullEmoji(emoji)}`,
              footer: {
                text: 'Check the console for more information'
              }
            });
          }
        }
      });

      if (!emoji.fake) {
        features.push({
          type: 'button',
          name: 'Go to server',
          onClick: () => {
            this.transitionTo(this.getGuildRoute(emoji.guildId));
          }
        });
      }

      features.push({
        type: 'button',
        name: 'Copy Emote ID',
        onClick: () => clipboard.writeText(emoji.id)
      });

      return features;
    };

    const getCreateableFeatures = (target) => {
      const url = getOwnerInstance(target).props.href || target.src;

      const onGuildClick = (guild) => {
        if (!guild) {
          if (this.settings.get('defaultCloneIdUseCurrent')) {
            guild = this.getGuild(this.getChannel(this.getChannelId()).guild_id);
          } else if (this.settings.get('defaultCloneId')) {
            guild = this.getGuild(this.settings.get('defaultCloneId'));
            if (!guild) {
              return this.replyError('You are no longer in your default server, please update your settings');
            }
          }

          if (guild) {
            if (!this.hasPermission(guild.id, Permissions.MANAGE_EMOJIS)) {
              return this.replyError(`Missing permissions to upload emotes in **${guild.name}**`);
            }
          } else {
            return this.replyError('You do not have a default server, please update your settings');
          }
        }

        if (this.getEmojis(guild.id, this.getExtension(url) === 'gif').length >= this.getMaxEmojiSlots(guild.id)) {
          return this.replyError(`**${guild.name}** does not have any more emote slots`);
        }

        openModal(() => React.createElement(EmojiNameModal, {
          onConfirm: async (name) => {
            name = name.replace(EMOJI_RE, '').substr(0, EMOJI_MAX_LENGTH);

            if (name.length < 2) {
              this.replyError('Please enter an emote name with 2 or more valid characters, valid characters are **a-z**, **0-9** and **_**');

              return;
            }

            try {
              await this.uploadEmoji(guild.id, await this.getImageEncoded(url), name);

              this.replySuccess(`Created emote by the name of **${name}** in **${guild.name}**`);
            } catch (error) {
              console.error(error);

              if (error.body && error.body.image) {
                this.replyError(error.body.image[0]);
              } else if (error.body && error.body.message) {
                this.replyError(error.body.message);
              } else {
                this.replyError('Failed to create emote, check the console for more information', {
                  description: 'Failed to create emote',
                  footer: {
                    text: 'Check the console for more information'
                  }
                });
              }
            }
          }
        }));
      };

      const getCreateableGuilds = () => {
        const items = [];
        const createableGuilds = Object.values(this.getFlattenedGuilds()).filter(guild => this.hasPermission(guild.id, Permissions.MANAGE_EMOJIS));

        for (const guild of createableGuilds) {
          items.push({
            type: 'button',
            name: guild.name,
            onClick: () => onGuildClick(guild)
          });
        }

        return items;
      };

      const features = [];

      features.push({
        type: 'submenu',
        hint: 'in',
        name: 'Create',
        onClick: () => onGuildClick(null),
        getItems: getCreateableGuilds
      });

      return features;
    };

    this._injectContextMenu(getCloneableFeatures, getCreateableFeatures);
    /*
     * Discord broke this in a recent update so TODO: Figure out a new way of adding the emote context to reactions
     *
     * const AnimatedComponent = (await getModule([ 'createAnimatedComponent' ])).div;
     * inject('pc-emojiUtility-reactionContext', AnimatedComponent.prototype, 'render', function (args, res) {
     * if (this.props.className && this.props.className.includes('pc-reaction')) {
     * res.props.onContextMenu = (e) => {
     * const { props: propEmoji } = this.props.children.props.children[0];
     *
     * if (propEmoji.emojiId) {
     * let emoji = _this.getEmojiById(propEmoji.emojiId);
     * if (emoji) {
     * emoji.fake = false;
     * } else {
     * emoji = _this.createFakeEmoji(propEmoji.emojiId, propEmoji.emojiName, `https://${CDN_HOST}/emojis/${propEmoji.emojiId}.${propEmoji.animated ? 'gif' : 'png'}`);
     * }
     *
     * const { pageX, pageY } = e;
     * contextMenu.openContextMenu(e, () =>
     * React.createElement(ContextMenu, {
     * pageX,
     * pageY,
     * itemGroups: [ [ {
     * type: 'submenu',
     * name: 'Emote',
     * getItems: () => getCloneableFeatures(emoji)
     * } ] ]
     * })
     * );
     * }
     * };
     * }
     *
     * return res;
     * });
     *
     * @todo: properly inject like commands does
     * injectInFluxContainer('pc-emojiUtility-hideEmojisPickerRm', 'EmojiPicker', 'removeEmotes', function () {
     * const hiddenGuilds = _this.settings.get('hiddenGuilds', []);
     * const hiddenNames = hiddenGuilds.map(id => _this.getGuild(id).name);
     *
     * this.setState({
     * metaData: this.state.metaData.map(meta => ({
     * ...meta,
     * items: meta.items.filter(item => !item.emoji.guildId || !hiddenGuilds.includes(item.emoji.guildId))
     * })).filter(meta => meta.items.length > 0)
     * });
     *
     * let previousOffset = 0;
     * let offsetDiff = 0;
     * this.categories = this.categories.map(category => {
     * if (category.category.startsWith('custom') && hiddenNames.includes(category.title)) {
     * offsetDiff += category.offsetTop - previousOffset;
     * previousOffset = category.offsetTop;
     * delete this.categoryOffsets[category.category];
     * return null;
     * }
     * category.offsetTop -= offsetDiff;
     * this.categoryOffsets[category.category] = category.offsetTop;
     * previousOffset = category.offsetTop;
     * return category;
     * }).filter(category => !!category);
     * });
     *
     * injectInFluxContainer('pc-emojiUtility-hideEmojisPickerMount', 'EmojiPicker', 'componentDidMount', function () {
     * this.removeEmotes();
     * });
     *
     * injectInFluxContainer('pc-emojiUtility-hideEmojisPicker', 'EmojiPicker', 'componentDidUpdate', function () {
     * if (this.state.searchResults) {
     * this.shouldFilter = true;
     * } else {
     * if (this.shouldFilter) {
     * this.shouldFilter = false;
     * this.removeEmotes();
     * }
     * }
     * });
     */

    const { AUTOCOMPLETE_OPTIONS: AutocompleteTypes } = await getModule([ 'AUTOCOMPLETE_OPTIONS' ]);
    inject('pc-emojiUtility-hideEmojisComplete', AutocompleteTypes.EMOJIS_AND_STICKERS, 'queryResults', (args, res) => {
      res.emojis = res.emojis.filter(emoji => !this.getHiddenGuilds().includes(emoji.guildId));
      return res;
    });

    powercord.api.settings.registerSettings('pc-emojiUtility', {
      category: this.entityID,
      label: 'Emote Utility',
      render: Settings
    });

    powercord.api.commands.registerCommand({
      command: 'findemote',
      description: 'Find the server an emote is from',
      usage: '{c} [emote]',
      executor: (args) => {
        const object = this.findEmojisForCommand(args);
        if (!object) {
          return;
        }

        const { foundEmojis, notFoundEmojis } = object;

        if (this.settings.get('useEmbeds')) {
          return {
            send: false,
            result: {
              type: 'rich',
              description: foundEmojis.map(emoji => `${this.getFullEmoji(emoji)} is from **[${emoji.guild.name}](${this.getGuildUrl(emoji.guildId)})**`).join('\n'),
              color: colors.success,
              footer: notFoundEmojis.length > 0
                ? {
                  text: `${notFoundEmojis.length} of the provided arguments ${notFoundEmojis.length === 1 ? 'is not a custom emote' : 'are not custom emotes'}`
                }
                : null
            }
          };
        }

        let description = foundEmojis.map(emoji => `${this.getFullEmoji(emoji)} is from **${emoji.guild.name}**${this.settings.get('displayLink') ? ` (**${this.getGuildUrl(emoji.guildId)}**)` : ''}`).join('\n');
        if (notFoundEmojis.length > 0) {
          description += `${description.length > 0 ? '\n\n' : ''}**${notFoundEmojis.length}** of the provided arguments ${notFoundEmojis.length === 1 ? 'is not a custom emote' : 'are not custom emotes'}`;
        }

        return {
          send: false,
          result: description
        };
      }
    });

    powercord.api.commands.registerCommand({
      command: 'massemote',
      description: 'Send all emotes containing the specified name',
      usage: '{c} [emote name]',
      executor: (args) => {
        const argument = args.join(' ').toLowerCase();
        if (argument.length === 0) {
          return this.replyError('Please provide an emote name');
        }

        const emojis = Object.values(this.emojiStore.getGuilds()).flatMap(g => g.emojis);

        const foundEmojis = emojis.filter(emoji => emoji.name.toLowerCase().includes(argument));
        if (foundEmojis.length > 0) {
          const emojisAsString = foundEmojis.map(emoji => this.getFullEmoji(emoji)).join(' ');
          if (emojisAsString.length > 2000) {
            return {
              send: false,
              result: `That is more than 2000 characters, let me send that locally instead!\n${emojisAsString}`
            };
          }

          if (!this.getCurrentUser().premiumType > 0) {
            return {
              send: false,
              result: `Looks like you do not have nitro, let me send that locally instead!\n${emojisAsString}`
            };
          }

          return {
            send: true,
            result: emojisAsString
          };
        }

        return this.replyError(`Could not find any emotes containing **${argument}**`);
      }
    });

    powercord.api.commands.registerCommand({
      command: 'saveemote',
      description: 'Save emotes to a specified directory',
      usage: '{c} [--server | emote]',
      executor: async (args) => {
        let filePath = this.settings.get('filePath');
        if (!filePath) {
          return this.replyError('Please set your save directory in the settings');
        }

        if (!existsSync(filePath)) {
          return this.replyError('The specified save directory does no longer exist, please update it in the settings');
        }

        let foundEmojis, notFoundEmojis;
        if (args.includes('--server')) {
          const { guild_id } = this.getChannel(this.getChannelId());
          if (!guild_id) {
            return this.replyError('The --server flag can not be used in dms');
          }

          if (this.settings.get('createGuildFolders')) {
            const guild = this.getGuildByIdOrName(guild_id);

            filePath = join(filePath, guild.name);
            if (!existsSync(filePath)) {
              mkdirSync(filePath);
            }
          }

          foundEmojis = this.getEmojis(guild_id);
          notFoundEmojis = [];
        } else {
          const object = this.findEmojisForCommand(args);
          if (!object) {
            return;
          }
          ({ foundEmojis, notFoundEmojis } = object);
        }

        if (notFoundEmojis.length > 0) {
          return this.replyError(`**${notFoundEmojis.length}** of the provided arguments ${notFoundEmojis.length === 1 ? 'is not a custom emote' : 'are not custom emotes'}`);
        }

        if (foundEmojis.length < 5) {
          for (const emoji of foundEmojis) {
            try {
              const name = this.settings.get('includeIdForSavedEmojis') ? `${emoji.name} (${emoji.id})` : emoji.name;

              await writeFile(resolve(filePath, name + extname(parse(emoji.url).pathname)), (await get(emoji.url)).raw);

              this.replySuccess(`Downloaded ${this.getFullEmoji(emoji)}`);
            } catch (error) {
              console.error(error);

              this.replyError(`Failed to download ${this.getFullEmoji(emoji)}, check the console for more information`, {
                description: `Failed to download ${this.getFullEmoji(emoji)}`,
                footer: {
                  text: 'Check the console for more information'
                }
              });
            }
          }
        } else {
          this.replySuccess(`Downloading **${foundEmojis.length}** emotes, I will report back to you when I am done`);

          const failedDownloads = [];

          for (const emoji of foundEmojis) {
            try {
              const name = this.settings.get('includeIdForSavedEmojis') ? `${emoji.name} (${emoji.id})` : emoji.name;

              await writeFile(resolve(filePath, name + extname(parse(emoji.url).pathname)), (await get(emoji.url)).raw);
            } catch (error) {
              console.error(error);

              failedDownloads.push(emoji);
            }
          }

          this.replySuccess(`Successfully downloaded **${foundEmojis.length - failedDownloads.length}**/**${foundEmojis.length}** emotes`);
        }
      }
    });

    powercord.api.commands.registerCommand({
      command: 'cloneemote',
      description: 'Clone an emote to your own server',
      usage: '{c} [emote] [server]',
      executor: async (args) => {
        if (args.length === 0) {
          return this.replyError('Please provide an emote');
        }

        const emojiRaw = args[0];
        const matcher = emojiRaw.match(this.getEmojiRegex());
        if (!matcher) {
          return this.replyError(`**${emojiRaw}** is not a custom emote`);
        }

        let guild;

        const guildArg = args.slice(1).join(' ');
        if (guildArg.length > 0) {
          guild = this.getGuildByIdOrName(guildArg);
          if (!guild) {
            return this.replyError('That is not a valid server');
          }
        } else {
          if (this.settings.get('defaultCloneIdUseCurrent')) {
            guild = this.getGuild(this.getChannel(this.getChannelId()).guild_id);
          } else if (this.settings.get('defaultCloneId')) {
            guild = this.getGuild(this.settings.get('defaultCloneId'));
            if (!guild) {
              return this.replyError('You are no longer in your default clone server, please update your settings');
            }
          }

          if (!guild) {
            return this.replyError('No server argument was provided');
          }
        }

        const emoji = Object.values(this.emojiStore.getGuilds()).flatMap(g => g.emojis).find(e => e.id === matcher[2]);
        if (emoji) {
          try {
            if (!this.hasPermission(guild.id, Permissions.MANAGE_EMOJIS)) {
              return this.replyError(`Missing permissions to upload emotes in **${guild.name}**`);
            }

            if (this.getEmojis(guild.id, emoji.animated).length >= this.getMaxEmojiSlots(guild.id)) {
              return this.replyError(`**${guild.name}** does not have any more emote slots`);
            }

            await this.uploadEmoji(guild.id, await this.getImageEncoded(emoji.url), emoji.name);

            return this.replySuccess(`Cloned emote ${this.getFullEmoji(emoji)} to **${guild.name}**`);
          } catch (error) {
            console.error(error);

            if (error.body.message) {
              return this.replyError(error.body.message);
            }
            return this.replyError('Failed to clone emote, check the console for more information', {
              description: 'Failed to clone emote',
              footer: {
                text: 'Check the console for more information'
              }
            });
          }
        } else {
          return this.replyError(`Could not find emote ${emojiRaw}`);
        }
      }
    });
  }

  pluginWillUnload () {
    powercord.api.settings.unregisterSettings('pc-emojiUtility');
    powercord.api.commands.unregisterCommand('cloneemote');
    powercord.api.commands.unregisterCommand('findemote');
    powercord.api.commands.unregisterCommand('massemote');
    powercord.api.commands.unregisterCommand('saveemote');
    uninject('pc-emojiUtility-emojiContext');
    uninject('pc-emojiUtility-reactionContext');
    uninject('pc-emojiUtility-hideEmojisPicker');
    uninject('pc-emojiUtility-hideEmojisPickerRm');
    uninject('pc-emojiUtility-hideEmojisPickerMount');
    uninject('pc-emojiUtility-hideEmojisComplete');
  }

  async _injectContextMenu (cloneSubMenu, createSubMenu) {
    const { imageWrapper } = await getModule([ 'imageWrapper' ]);
    const { MenuSeparator } = await getModule([ 'MenuGroup' ]);
    const mdl = await getModule(m => m.default && m.default.displayName === 'MessageContextMenu');
    inject('pc-emojiUtility-emojiContext', mdl, 'default', ([ { target } ], res) => {
      if (target.classList.contains('emoji')) {
        const matcher = target.src.match(this.getEmojiUrlRegex());
        if (matcher) {
          let emoji = this.getEmojiById(matcher[1]);
          if (emoji) {
            emoji.fake = false;
          } else {
            emoji = this.createFakeEmoji(matcher[1], target.alt.substring(1, target.alt.length - 1), target.src);
          }

          res.props.children.push(
            React.createElement(MenuSeparator),
            ...ContextMenu.renderRawItems(cloneSubMenu(emoji))
          );
        }
      } else if (target.tagName.toLowerCase() === 'img' && target.parentElement.classList.contains(imageWrapper)) {
        res.props.children.push(
          React.createElement(MenuSeparator),
          ...ContextMenu.renderRawItems(createSubMenu(target))
        );
      }
      return res;
    });
    mdl.default.displayName = 'MessageContextMenu';
  }
};
