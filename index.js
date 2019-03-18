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
  challenge.currentScores();
  console.log(new Date(challenge.lastUpdate).toString());
  console.log(challenge.api.sdvx[4]._links.profiles);
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
      bot.sendMessage(msg.from.id,
        `*Current standings for Sound Voltex*\n\n`+
        `*1st* - Player1 - 1874\n`+
        `*2nd* - Player2 - 1594\n`+
        `*3rd* - Player3 - 1567\n`+
        `*4th* - Player4 - 1478\n`+
        `*5th* - Player5 - 1426\n`
        ,{parse_mode:'Markdown'});
  });

  bot.onText(/\/register/i, (msg, match) => {
    if (msg.chat.type != "private"){
      bot.sendMessage(msg.chat.id, 'Please message bot privately to register');
    }
    else{
      challenge.updateState(msg.from.id, 'REG_INIT', 'REGISTER').then((result) => {
        console.log(result);
        if (result === 0) {
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
        else bot.sendMessage(msg.chat.id,'Something went wrong, please message bot owner.');
      })
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
      let options = {};
      switch (state.current_state){
        case 'REG_NAME_AWAIT_IIDX':
          options = {
            player_name: msg.text.toUpperCase(),
            version: contestData.iidx.version,
            chart_id: contestData.iidx.chart_id
          };
          challenge.getPlayerData(options, 'IIDX').then((response) => {
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
          break;

        case 'REG_NAME_AWAIT_SDVX':
          options = {
            player_name: msg.text.toUpperCase(),
            version: contestData.sdvx.version,
            chart_id: contestData.sdvx.chart_id
          };
          challenge.getPlayerData(options,'SDVX').then((response) => {
            if (response === 1) bot.sendMessage(msg.chat.id, 'Player wasn\'t found, please try again.');
            else {
              challenge.updateState(msg.from.id, 'REG_CONFIRM_AWAIT_SDVX', 'REG_NAME_ENTRY')
              .then(() => challenge.updateNetworkName(msg.from.id, response.name, 'SDVX'))
              .then(() => challenge.updateId(msg.from.id, response.network_id, 'SDVX'))
              .then(() => {
                bot.sendMessage(msg.chat.id,
                  `Does this look like you?\n`+
                  `*PLayer name:*${response.name}\n`+
                  `*SDVX ID:*${response.sdvx_id}\n`
                ,{parse_mode:'Markdown',
                  reply_markup:{inline_keyboard:[[{text:'Yes', callback_data:'REG_CONFIRM_SDVX'},{text:'No', callback_data:'REG_DENY_SDVX'}]]}
                });
              });
            }
          });
          break;
      }
    })
  });

  bot.on('callback_query', (callback) => {
    switch (callback.data) {
      case 'REG_REQ_IIDX':
        challenge.checkRegistry(callback.from.id, 'IIDX').then((result) => {
          if (result === true){
            bot.answerCallbackQuery(callback.id);
            bot.editMessageText('You have already been registered for this title.',
              {
                "chat_id":callback.message.chat.id,
                "message_id":callback.message.message_id
              }
            );
          }
          else {
            challenge.updateState(callback.from.id, 'REG_NAME_AWAIT_IIDX', 'REG_NAME_CALLBACK_IIDX')
            bot.answerCallbackQuery(callback.id);
            bot.editMessageText('Alright, send me your IIDX DJ name.',
              {
                "chat_id":callback.message.chat.id,
                "message_id":callback.message.message_id
              }
            );         
          }

        });
      break; 
      case 'REG_REQ_SDVX':
        challenge.checkRegistry(callback.from.id, 'SDVX').then((result) => {
          if (result === true){
            bot.answerCallbackQuery(callback.id);
            bot.editMessageText('You have already been registered for this title.',
              {
                "chat_id":callback.message.chat.id,
                "message_id":callback.message.message_id
              }
            );
          }
          else {
            challenge.updateState(callback.from.id, 'REG_NAME_AWAIT_SDVX', 'REG_NAME_CALLBACK_SDVX')
            bot.answerCallbackQuery(callback.id);
            bot.editMessageText('Alright, send me your SDVX profile name.',
              {
                "chat_id":callback.message.chat.id,
                "message_id":callback.message.message_id
              }
            );         
          }

        });
      break;;
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
          return challenge.updateScore(callback.from.id, score, 'IIDX');})
        .then((score) => {
          bot.answerCallbackQuery(callback.id);
          if(score === 0) bot.sendMessage(callback.from.id, 
            `Looks like you haven't played this chart yet.\n`+
            `Don't worry, your score will appear in the contest once you play it.`);
          else bot.sendMessage(callback.from.id, `Found it! Your high score for the current chart is ${score}.`);
        })
        break;

      case 'REG_CONFIRM_SDVX':
        challenge.registerTitle(callback.from.id, "SDVX");
        challenge.updateState(callback.from.id, 'REG_COMPLETE_SDVX', 'REG_CALLBACK_CONFIRM');
        bot.editMessageText('Awesome, your name has been registered!\n\nI am looking for your score now, which may take a couple of seconds.',
          {
            "chat_id":callback.message.chat.id,
            "message_id":callback.message.message_id
          }
        );
        challenge.retrieveIdLocal(callback.from.id,'SDVX').then((id) => {
          let options = {
            version: contestData.sdvx.version,
            chart_id: contestData.sdvx.chart_id
          };

          let url = `${challenge.api.sdvx[options.version]._links.player_bests}?profile_id=${id.SDVX}`;
          return challenge.getScore(options, url);
          })
          .then((score) => {
            return challenge.updateScore(callback.from.id, score, 'SDVX');
          })
          .then((score) => {
            if(score === 0) {
              bot.sendMessage(callback.from.id, 
                `Looks like you haven't played this chart yet.\n`+
                `Don't worry, your score will appear in the contest once you play it.`);
              bot.answerCallbackQuery(callback.id);
            }
            else {
              bot.sendMessage(callback.from.id, `Found it! Your high score for the current chart is ${score}.`);
              bot.answerCallbackQuery(callback.id);
            }
          });
          break;

      case 'REG_DENY_IIDX':
        challenge.updateState(callback.from.id, 'REG_NAME_AWAIT_IIDX', 'REG_NAME_CALLBACK_IIDX')
        bot.answerCallbackQuery(callback.id);
        bot.editMessageText(`No problem, let's try again!\nSend me your IIDX DJ name.`,
          {
            "chat_id":callback.message.chat.id,
            "message_id":callback.message.message_id
          }
        );
        break;

      case 'REG_DENY_SDVX':
        challenge.updateState(callback.from.id, 'REG_NAME_AWAIT_SDVX', 'REG_NAME_CALLBACK_SDVX')
        bot.answerCallbackQuery(callback.id);
        bot.editMessageText(`No problem, let's try again!\nSend me your SDVX player name.`,
          {
            "chat_id":callback.message.chat.id,
            "message_id":callback.message.message_id
          }
        );
        break; 

    }
  });
})

