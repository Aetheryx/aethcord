/**
 * Copyright (c) 2018-2021 aetheryx & Bowser65
 * All Rights Reserved. Licensed under the Porkord License
 * https://powercord.dev/porkord-license
 */

const { getModuleByDisplayName } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');

module.exports = async () => {
  const TabBar = await getModuleByDisplayName('TabBar');
  inject('pc-utilitycls-tabbar', TabBar.Item.prototype, 'render', function (_, res) {
    res.props['data-item-id'] = this.props.id.replace(/&/g, 'n').replace(/ /g, '');
    return res;
  });

  return async () => {
    uninject('pc-utilitycls-tabbar');
  };
};
