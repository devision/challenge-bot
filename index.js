"use strict";

const TelegramBot = require('node-telegram-bot-api');

const challenge = require('./challenge');

// replace the value below with the Telegram token you receive from @BotFather
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
      bot.sendMessage(msg.chat.id,
        `Hello, ${msg.from.username}!\n`+
        `Use the commands below to participate in the challenge:\n`+
        `\/register - register your network account.\n`+
        `\/standings - display current standings.\n`+
        `\/cancel - cancel your participation.\n`+
        `Please remember: commands, related to your account are only accessible if you message me personally.`
        , {parse_mode:'Markdown'});
  });

  bot.onText(/\/register ([^\s]+)/i, (msg, match) => {
    console.log(contestData);
    if (msg.chat.type != "private"){
      bot.sendMessage(msg.chat.id, 'Please message bot privately to register.');
    }
    else {
      let options = {
        player_name: msg.text.slice(msg.entities[0].length + 1).toUpperCase(),
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

  bot.on('callback_query', (callback) => {
    switch (callback.data) {
      case 'REG_REQ_IIDX':
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
    }
  });
})

