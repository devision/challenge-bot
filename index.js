"use strict";

const TelegramBot = require('node-telegram-bot-api');

const challenge = require('./challenge');

const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN;

const telegramOptions = {
  webHook: {
    port: process.env.BOT_PORT,
    cert: process.env.BOT_CERTIFICATE,
    key: process.env.BOT_PRIVATE_KEY
  }
};

const host = process.env.BOT_HOST + `:${process.env.BOT_PORT}/` + process.env.TELEGRAM_API_TOKEN;

const bot = new TelegramBot(TELEGRAM_API_TOKEN, telegramOptions);
bot.setWebHook(host, {certificate: telegramOptions.webHook.cert});

let contestData = {};

challenge.initializeApplication().then((success) => {
  if (success === 'APP_INIT_SUCCESS') {
    console.info('Application successfully initialized');
    return challenge.getContestData();
  }
}, (failure) => {
  console.info(failure);
  process.exit(1);
})

.then((result) => {
  contestData = result;
})

.then(() => {
  bot.onText(/\/help$|\/help@(.+bot)|\/start$|\/start@(.+bot)/i, (msg, match) => {
    challenge.initUser(msg.from.id).then((result) => {
      console.log(result);
      if (result === 2 || result === 3) {
        bot.sendMessage(msg.chat.id, 'Something went wrong, please message bot owner.')
      }

      else if (result === 0 || result === 1) {
        bot.sendMessage(msg.chat.id,
          `Hello, ${msg.from.username}!\n`+
          `Use the commands below to participate in the challenge:\n\n`+
          `\/register - register your network account.\n`+
          `\/standings - display current standings.\n`+
          `\/cancel - cancel your participation.\n\n`+
          `Please remember: commands, related to your account are only accessible if you message me personally.`
        ,{parse_mode:'Markdown'});
      }
    })
  });

  bot.onText(/\/test/i, (msg, match) => {
    challenge.retrieveIdLocal(msg.from.id,'IIDX').then((id) => {
      let options = {
        player_name: msg.text.toUpperCase(),
        version: contestData.iidx.version,
        chart_id: contestData.iidx.chart_id
      };

      let url = `${challenge.api.iidx[options.version]._links.player_bests}?profile_id=${id.IIDX}`;
      return challenge.getScore(options, url);
    })

    .then((score) => {
      bot.sendMessage(msg.chat.id, `${score}`);
    });
  });

  bot.onText(/\/register ([^\s]+)/i, (msg, match) => {
    console.log(contestData);
    if (msg.chat.type != "private"){
      bot.sendMessage(msg.chat.id, 'Please message bot privately to register.');
    }
    else {
      let options = {
        player_name: msg.text.toUpperCase(),
        version: contestData.iidx.version,
        chart_id: contestData.iidx.chart_id
      };

      challenge.initUser(msg.from.id).then((result) => {
        if (result){
          challenge.getPlayerData(options).then((response) => {
            if (response === 1) bot.sendMessage(msg.chat.id, 'Player wasn\'t found, please try again.');
            else bot.sendMessage(msg.chat.id,
              `Hello, ${msg.from.username}.\n`+
              `Does this look like you?\n`+
              `*DJ Name:*${response.dj_name}\n`+
              `*IIDX ID:*${response.iidx_id}\n`+
              `*SP Rank:*${response.sp_rank}\n`+
              `*DP Rank:*${response.dp_rank}\n`+
              `*SP Points:*${response.sp_points}\n`+
              `*DP Points:*${response.dp_points}\n`
              ,{parse_mode:'Markdown',
                reply_markup:{inline_keyboard:[[{text:'Yes', callback_data:'REG_CONFIRM'},{text:'No', callback_data:'REG_DENY'}]]}
            });
              console.log(msg);
          });
        }

        else if (result === 1) {
          bot.sendMessage(msg.chat.id, 'You have already registered');
        }

        else if (result > 1) {
          bot.sendMessage(msg.chat.id, 'Something bad has happened. Please message bot owner and let them know. Thanks!');
        }

      });
    }
});

  bot.onText(/\/register/i, (msg, match) => {
    challenge.updateState(msg.from.id, 'REG_INIT', 'REGISTER');
    if (msg.chat.type != "private"){
      bot.sendMessage(msg.chat.id, 'Please message bot privately to register');
    }
    else{
      bot.sendMessage(msg.chat.id,
        'Please select a challenge to participate in.',
        {reply_markup:{
          inline_keyboard:
            [[{text:'Beatmania',callback_data:'REG_REQ_IIDX'},
              {text:'Sound Voltex', callback_data:'REG_REQ_SDVX'}
            ]]
          }
        }
      )
    }
  });

  bot.onText(/^\/register@(.+bot)$/i, (msg, match) => {
    console.log("Received /register command");
    if (msg.chat.type != "private"){
      bot.sendMessage(msg.chat.id, 'Please message bot privately to register');
    }
  });

  bot.onText(/^(?:Yes|No)$/i,(msg, match) => {
    if (/^(?:Yes)$/i.test(match)) console.log("Received Yes");
    else console.log("Received No");
  });

  bot.onText(/^[^/]{1}[^\s]*$/i, (msg, match) => {
    challenge.getCurrentState(msg.from.id).then((state) => {
      if (state.current_state === 'REG_NAME_AWAIT_IIDX') {
        let options = {
          player_name: msg.text.toUpperCase(),
          version: contestData.iidx.version,
          chart_id: contestData.iidx.chart_id
        };
        challenge.getPlayerData(options).then((response) => {
          console.log(response);
          if (response === 1) bot.sendMessage(msg.chat.id, 'Player wasn\'t found, please try again.');
          else {
            challenge.updateState(msg.from.id, 'REG_CONFIRM_AWAIT_IIDX', 'REG_NAME_ENTRY')
            .then(() => challenge.updateNetworkName(msg.from.id, response.dj_name, 'IIDX'))
            .then(() => challenge.updateId(msg.from.id, response.network_id, 'IIDX'))
            .then(() => {
              bot.sendMessage(msg.chat.id,
                `Does this look like you?\n`+
                `*DJ Name:*${response.dj_name}\n`+
                `*IIDX ID:*${response.iidx_id}\n`+
                `*SP Rank:*${response.sp_rank}\n`+
                `*DP Rank:*${response.dp_rank}\n`+
                `*SP Points:*${response.sp_points}\n`+
                `*DP Points:*${response.dp_points}\n`
              ,{parse_mode:'Markdown',
                reply_markup:{inline_keyboard:[[{text:'Yes', callback_data:'REG_CONFIRM_IIDX'},{text:'No', callback_data:'REG_DENY_IIDX'}]]}
              });
            });
          }
        });
        challenge.getPlayerData(options)
      }
    })
  });

  bot.on('callback_query', (callback) => {
    switch (callback.data) {
      case 'REG_REQ_IIDX':
        challenge.updateState(callback.from.id, 'REG_NAME_AWAIT_IIDX', 'REG_NAME_CALLBACK_IIDX')
        bot.answerCallbackQuery(callback.id);
        bot.editMessageText('Send me your IIDX DJ name, so I can remember it.',
          {
            "chat_id":callback.message.chat.id,
            "message_id":callback.message.message_id
          }
        );
        break;
      case 'REG_REQ_SDVX':
        bot.answerCallbackQuery(callback.id);
        bot.editMessageText('Send me your SDVX account name, so I can remember it.',
          {
            "chat_id":callback.message.chat.id,
            "message_id":callback.message.message_id
          }
        );
        break;
      case 'REG_CONFIRM_IIDX':
        challenge.registerTitle(callback.from.id, "IIDX");
        challenge.updateState(callback.from.id, 'REG_COMPLETE_IIDX', 'REG_CALLBACK_CONFIRM');
        bot.editMessageText('Awesome, your name has been registered!\n\nI am looking for your score now, which may take a couple of seconds.',
          {
            "chat_id":callback.message.chat.id,
            "message_id":callback.message.message_id
          }
        );
        challenge.retrieveIdLocal(callback.from.id,'IIDX').then((id) => {
          let options = {
            version: contestData.iidx.version,
            chart_id: contestData.iidx.chart_id
          };

          let url = `${challenge.api.iidx[options.version]._links.player_bests}?profile_id=${id.IIDX}`;
          return challenge.getScore(options, url);
          })

        .then((score) => {
          bot.answerCallbackQuery(callback.id);
          if(score === 0) bot.sendMessage(callback.from.id, 
              `Looks like you haven't played this chart yet.\n`+
              `Don't worry, your score will appear in the contest once you play it.`);
          else bot.sendMessage(callback.from.id, `Found it! Your high score for the current chart is ${score}.`);
        });

    }
  });
})

