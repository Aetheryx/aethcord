const Plugin = require('powercord/Plugin');
const { getModule, channels: { getSelectedChannelState, getChannelId }, constants: { Routes, APP_URL_PREFIX }, React, messages: { createBotMessage, receiveMessage } } = require('powercord/webpack');

const { existsSync, createWriteStream } = require('fs');
const { get } = require('https');
const { extname } = require('path');
const { parse } = require('url');

const emojiStore = getModule([ 'getGuildEmoji' ]);

const Settings = require('./Settings.jsx');

module.exports = class EmojiUtility extends Plugin {
  getEmojiRegex () {
    return /^<a?:([a-zA-Z0-9_]+):([0-9]+)>$/;
  }

  getGuildUrl (guild) {
    let selectedChannel = getSelectedChannelState()[guild.id];
    if (!selectedChannel) {
      /* I am not sure if it can get here but just to be sure */
      selectedChannel = guild.systemChannelId;
    }

    return APP_URL_PREFIX + Routes.CHANNEL(guild.id, selectedChannel); // eslint-disable-line new-cap
  }

  getFullEmoji (emoji) {
    return `<${(emoji.animated ? 'a' : '')}:${emoji.name}:${emoji.id}>`;
  }

  download (url) {
    return new Promise((resolve, reject) => {
      get(url)
        .on('response', (response) => resolve(response))
        .on('error', (error) => reject(error));
    });
  }

  write (path, stream) {
    return new Promise((resolve, reject) => {
      const writeStream = createWriteStream(path)
        .on('finish', () => resolve())
        .on('error', (error) => reject(error));

      stream.pipe(writeStream);
    });
  }

  sendBotMessage (content) {
    const receivedMessage = createBotMessage(getChannelId(), '');

    if (typeof content === 'string') {
      receivedMessage.content = content;
    } else {
      receivedMessage.embeds.push(content);
    }

    return receiveMessage(receivedMessage.channel_id, receivedMessage);
  }

  start () {
    powercord
      .pluginManager
      .get('pc-settings')
      .register(
        'pc-emojiUtility',
        'Emote Utility',
        () =>
          React.createElement(Settings, {
            settings: this.settings
          })
      );

    powercord
      .pluginManager
      .get('pc-commands')
      .register(
        'findemote',
        'Find the server an emote is from',
        '{c} [emote]',
        (args) => {
          if (args.length === 0) {
            return {
              send: false,
              result: this.settings.get('useEmbeds')
                ? {
                  type: 'rich',
                  description: 'Please provide an emote',
                  color: 16711680
                }
                : 'Please provide an emote'
            };
          }

          const emojis = [ ...new Set(Object.values(emojiStore.getGuilds()).flatMap(r => r.emojis)) ];

          const foundEmojis = [];
          const notFoundEmojis = [];

          for (const argument of args) {
            const matcher = argument.match(this.getEmojiRegex());
            if (matcher) {
              const emoji = emojis.find(e => e.id === matcher[2]);

              if (emoji) {
                const guild = getModule([ 'getGuild' ]).getGuild(emoji.guildId);

                foundEmojis.push({
                  emoji,
                  guild
                });

                continue;
              }

              if (args.length === 1) {
                return {
                  send: false,
                  result: this.settings.get('useEmbeds')
                    ? {
                      type: 'rich',
                      description: `Could not find emote ${argument}`,
                      color: 16711680
                    }
                    : `Could not find emote ${argument}`
                };
              }
            }

            if (args.length === 1) {
              return {
                send: false,
                result: this.settings.get('useEmbeds')
                  ? {
                    type: 'rich',
                    description: `**${argument}** is not a custom emote`,
                    color: 16711680
                  }
                  : `**${argument}** is not a custom emote`
              };
            }

            notFoundEmojis.push(argument);
          }

          if (this.settings.get('useEmbeds')) {
            return {
              send: false,
              result: {
                type: 'rich',
                description: foundEmojis.map(found => `${this.getFullEmoji(found.emoji)} is from **[${found.guild.name}](${this.getGuildUrl(found.guild)})**`).join('\n'),
                color: 65280,
                footer: notFoundEmojis.length > 0
                  ? {
                    text: `${notFoundEmojis.length} of the provided arguments ${notFoundEmojis.length === 1 ? 'is not a custom emote' : 'are not custom emotes'}`
                  }
                  : null
              }
            };
          }

          let description = foundEmojis.map(found => `${this.getFullEmoji(found.emoji)} is from **${found.guild.name}**${this.settings.get('displayLink') ? ` (**${this.getGuildUrl(found.guild)}**)` : ''}`).join('\n');
          if (notFoundEmojis.length > 0) {
            description += `${description.length > 0 ? '\n\n' : ''}**${notFoundEmojis.length}** of the provided arguments ${notFoundEmojis.length === 1 ? 'is not a custom emote' : 'are not custom emotes'}`;
          }

          return {
            send: false,
            result: description
          };
        }
      );

    powercord
      .pluginManager
      .get('pc-commands')
      .register(
        'massemote',
        'Send all emotes containing the specified name',
        '{c} [emote name]',
        (args) => {
          const argument = args.join(' ').toLowerCase();
          if (argument.length === 0) {
            return {
              send: false,
              result: this.settings.get('useEmbeds')
                ? {
                  type: 'rich',
                  description: 'Please provide an emote name',
                  color: 16711680
                }
                : 'Please provide an emote name'
            };
          }

          const emojis = Object.values(emojiStore.getGuilds()).flatMap(r => r.emojis);

          const foundEmojis = emojis.filter(emoji => emoji.name.toLowerCase().includes(argument));
          if (foundEmojis.length > 0) {
            const emojisAsString = foundEmojis.map(emoji => this.getFullEmoji(emoji)).join('');
            if (emojisAsString.length > 2000) {
              return {
                send: false,
                result: `That is more than 2000 characters, let me send that locally instead!\n${emojisAsString}`
              };
            }

            return {
              send: true,
              result: emojisAsString
            };
          }

          return {
            send: false,
            result: this.settings.get('useEmbeds')
              ? {
                type: 'rich',
                description: `Could not find any emotes containing **${argument}**`,
                color: 16711680
              }
              : `Could not find any emotes containing **${argument}**`
          };
        }
      );

    powercord
      .pluginManager
      .get('pc-commands')
      .register(
        'saveemote',
        'Save emotes to a specified file path',
        '{c} [emote]',
        async (args) => {
          let filePath = this.settings.get('filePath');

          if (!filePath) {
            return {
              send: false,
              result: this.settings.get('useEmbeds')
                ? {
                  type: 'rich',
                  description: 'Please set your save file path in the settings',
                  color: 16711680
                }
                : 'Please set your save file path in the settings'
            };
          }

          if (!filePath.endsWith('/')) {
            filePath += '/';
          }

          if (!existsSync(filePath)) {
            return {
              send: false,
              result: this.settings.get('useEmbeds')
                ? {
                  type: 'rich',
                  description: 'The specified file path does no longer exist, please update it in the settings',
                  color: 16711680
                }
                : 'The specified file path does no longer exist, please update it in the settings'
            };
          }

          if (args.length === 0) {
            return {
              send: false,
              result: this.settings.get('useEmbeds')
                ? {
                  type: 'rich',
                  description: 'Please provide an emote',
                  color: 16711680
                }
                : 'Please provide an emote'
            };
          }

          const emojis = [ ...new Set(Object.values(emojiStore.getGuilds()).flatMap(r => r.emojis)) ];

          const foundEmojis = [];
          const notFoundEmojis = [];

          for (const argument of args) {
            const matcher = argument.match(this.getEmojiRegex());
            if (matcher) {
              const emoji = emojis.find(e => e.id === matcher[2]);
              if (emoji) {
                foundEmojis.push(emoji);

                continue;
              }

              if (args.length === 1) {
                return {
                  send: false,
                  result: this.settings.get('useEmbeds')
                    ? {
                      type: 'rich',
                      description: `Could not find emote ${argument}`,
                      color: 16711680
                    }
                    : `Could not find emote ${argument}`
                };
              }
            }

            if (args.length === 1) {
              return {
                send: false,
                result: this.settings.get('useEmbeds')
                  ? {
                    type: 'rich',
                    description: `**${argument}** is not a custom emote`,
                    color: 16711680
                  }
                  : `**${argument}** is not a custom emote`
              };
            }

            notFoundEmojis.push(argument);
          }

          if (notFoundEmojis.length > 0) {
            this.sendBotMessage(this.settings.get('useEmbeds')
              ? {
                type: 'rich',
                description: `**${notFoundEmojis.length}** of the provided arguments ${notFoundEmojis.length === 1 ? 'is not a custom emote' : 'are not custom emotes'}`,
                color: 16711680
              }
              : `**${notFoundEmojis.length}** of the provided arguments ${notFoundEmojis.length === 1 ? 'is not a custom emote' : 'are not custom emotes'}`
            );
          }

          if (foundEmojis.length < 5) {
            for (const emoji of foundEmojis) {
              try {
                await this.write(filePath + emoji.name + extname(parse(emoji.url).pathname), await this.download(emoji.url));

                this.sendBotMessage(this.settings.get('useEmbeds')
                  ? {
                    type: 'rich',
                    description: `Downloaded ${this.getFullEmoji(emoji)}`,
                    color: 65280
                  }
                  : `Downloaded ${this.getFullEmoji(emoji)}`
                );
              } catch (error) {
                console.error(error);

                this.sendBotMessage(this.settings.get('useEmbeds')
                  ? {
                    type: 'rich',
                    description: `Failed to download ${this.getFullEmoji(emoji)}`,
                    footer: 'Check the console for more information',
                    color: 16711680
                  }
                  : `Failed to download ${this.getFullEmoji(emoji)}, check the console for more information`
                );
              }
            }
          } else {
            this.sendBotMessage(this.settings.get('useEmbeds')
              ? {
                type: 'rich',
                description: `Downloading **${foundEmojis.length}** emotes, I will report back to you when I am done`,
                color: 65280
              }
              : `Downloading **${foundEmojis.length}** emotes, I will report back to you when I am done`
            );

            const failedDownloads = [];

            for (const emoji of foundEmojis) {
              try {
                await this.write(filePath + emoji.name + extname(parse(emoji.url).pathname), await this.download(emoji.url));
              } catch (error) {
                console.error(error);

                failedDownloads.push(emoji);
              }
            }

            this.sendBotMessage(this.settings.get('useEmbeds')
              ? {
                type: 'rich',
                description: `Successfully downloaded **${foundEmojis.length - failedDownloads.length}**/**${foundEmojis.length}** emotes`,
                color: 65280
              }
              : `Successfully downloaded **${foundEmojis.length - failedDownloads.length}**/**${foundEmojis.length}** emotes`
            );
          }
        }
      );
  }
};
