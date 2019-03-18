"use strict";

const rp = require('request-promise-native');
const sqlite = require('sqlite');
const sqlitePromise = sqlite.open('./data.sqlite');


const API_ROOT = process.env.API_ROOT;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const AUTH_HEADER = {Authorization: `Bearer ${AUTH_TOKEN}`};

let api = {};
let contest_options;
let lastUpdate = Date.now();

async function updateScore(telegram_id, score, title){
  let sqliteInit;
  let query;
  let scores;
  let localId = {};

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    return -2;
  }
  try {
    query = await sqliteInit.all('SELECT scores FROM bot WHERE telegram_id = ?;',[telegram_id]);
    scores = JSON.parse(query[0].scores);
    scores[title] = score;
    await sqliteInit.all('UPDATE bot SET scores = ? WHERE telegram_id = ?;'
      ,[JSON.stringify(scores), telegram_id]);    
  }
  catch (error){
    return -1;
  }

  return score;
}

async function currentScores(title){
  let sqliteInit;
  let query;
  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    return 2;
  }
  try {
    query = await sqliteInit.all('SELECT network_name, scores FROM bot;');
  }
  catch (error){
    return 1;
  }
  console.log(query[0].network_name);
  console.log(JSON.parse(query[0].network_name).IIDX);
  console.log(JSON.parse(query[0].scores).IIDX);
  console.log(JSON.parse(query[1].network_name).IIDX);
  console.log(JSON.parse(query[1].scores).IIDX);
  return query[0];
}

async function retrieveIdLocal(telegram_id, title){
  let sqliteInit;
  let query;
  let localId = {};

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    return 2;
  }
  try {
    query = await sqliteInit.all('SELECT network_id FROM bot WHERE telegram_id = ?;',[telegram_id]);
  }
  catch (error){
    return 1;
  }
  return JSON.parse(query[0].network_id);
}

async function registerTitle(telegram_id, title){
  let sqliteInit;
  let query;
  let titles = {};

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    return 2;
  }
  try {
    query = await sqliteInit.all('SELECT registered_titles FROM bot WHERE telegram_id = ?;',[telegram_id]);
    titles = JSON.parse(query[0].registered_titles);
    titles[title] = '1';
    await sqliteInit.all('UPDATE bot SET registered_titles = ? WHERE telegram_id = ?;'
      ,[JSON.stringify(titles), telegram_id]);
  }
  catch (error){
    return 1;
  }
  return 0;
}

async function updateNetworkName(telegram_id, networkName, title){
  let sqliteInit;
  let query;
  let names = {};

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    throw error;
  }
  try {
    query = await sqliteInit.all('SELECT network_name FROM bot WHERE telegram_id = ?;',[telegram_id]);
    console.log('Names - updateNetworkName');
    console.log(names);
    names = JSON.parse(query[0].network_name);
    names[title] = networkName;
    console.log(names);
    await sqliteInit.all('UPDATE bot SET network_name = ? WHERE telegram_id = ?;'
      ,[JSON.stringify(names), telegram_id]);
  }
  catch (error){
    console.log('error');
    return 1;
  }
}

async function updateId(telegram_id, networkId, title){
  let sqliteInit;
  let query;
  let ids = {};

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    throw error;
  }
  try {
    query = await sqliteInit.all('SELECT network_id FROM bot WHERE telegram_id = ?;',[telegram_id]);
    console.log(query);
    ids = JSON.parse(query[0].network_id);
    console.log(ids);
    ids[title] = networkId;
    await sqliteInit.all('UPDATE bot SET network_id = ? WHERE telegram_id = ?;'
      ,[JSON.stringify(ids), telegram_id]);
    console.log(ids);
  }
  catch (error){
    return 1;
  }
}

async function getContestData(){

  let sqliteInit;
  let contestData = {};

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    throw error;
  }
  let dbResult = await sqliteInit.all('SELECT * FROM contest;');
  dbResult.forEach((current, index) => {
    contestData[current.title] = {version: current.version, chart_id: current.chart_id}; 
  });
  console.log(contestData);
  return contestData;
}

async function getCurrentState(telegram_id){
  let sqliteInit;
  let currentState;

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    throw error;
  }
  try {
    currentState = await sqliteInit.all('SELECT current_state, last_command FROM bot WHERE telegram_id = ?;', [telegram_id]);
  }
  catch (error){
    throw error;
  }
  return currentState[0];
}

async function updateState(telegram_id, currentState, lastCommand){
  let sqliteInit;
  let test;

  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    return 2;
  }
  try {
    test = await sqliteInit.all('UPDATE bot SET current_state = ?, last_command = ? WHERE telegram_id = ?;'
    ,[currentState,lastCommand,telegram_id]); 
    return 0; 
  }
  catch (error){
    return 2;
  }
}

async function checkRegistry(telegram_id, title){
  let sqliteInit;
  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    throw error;
  }
  let check = await sqliteInit.all('SELECT registered_titles FROM bot WHERE telegram_id = ?',[telegram_id]);
  if((JSON.parse(check[0].registered_titles)[title]) === '1') return true;
  return false;
}

async function initUser(telegram_id){
  let sqliteInit;
  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    return 2; // SQL Error
  }

  let check = await sqliteInit.all('SELECT * FROM bot WHERE telegram_id = ?',[telegram_id]);
  if (check.length === 0){
    try {
      await sqliteInit.all('INSERT INTO bot (telegram_id, is_registered, current_state ) VALUES(?,?,?)',
      [telegram_id, '{}', 'NEW']);
    }
    catch (error){
      return 2; // SQL Error
    }

    return 0; // Normal exit
  }

  else if (check[0].telegram_id === telegram_id.toString()) return 1; // Already initialized
  return 3; // Uncaught error
}

async function initializeDatabase() {
  let sqliteInit;
  let sqliteCreateDatabase;
  let sqliteConfirmColumns;
  let sqliteConfirmBot;
  let sqliteConfirmContest;

  try{
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    throw error;
  }

  if ((sqliteInit.driver.open === true)
    && (sqliteInit.driver.filename === './data.sqlite')) {
      sqliteConfirmBot = await sqliteInit.all("PRAGMA TABLE_INFO('bot');");
      sqliteConfirmContest = await sqliteInit.all("PRAGMA TABLE_INFO('contest');");
      if (sqliteConfirmBot.length === 0 || 
          sqliteConfirmContest.length === 0) {
        await sqliteInit.all(
          'CREATE TABLE `bot` (' +
          '`telegram_id`  TEXT UNIQUE,' +
          '`is_registered`  TEXT DEFAULT \'{}\', ' +
          '`registered_titles`  TEXT DEFAULT \'{}\', ' +
          '`current_state`  TEXT DEFAULT \'NEW\', ' +
          '`last_command`  TEXT DEFAULT \'{}\', '+
          '`network_name`  TEXT DEFAULT \'{}\','+
          '`network_id`  TEXT DEFAULT \'{}\','+
          '`scores`  TEXT DEFAULT \'{}\','+
          'PRIMARY KEY(`telegram_id`));'
        );
        await sqliteInit.all(
          'CREATE TABLE `contest` (`title` TEXT,`version` INTEGER,`chart_id` TEXT);'
        );

        await sqliteInit.all('INSERT INTO `contest`(`title`,`version`,`chart_id`) VALUES (?,?,?), (?,?,?);',
          ['iidx',24,'HjfscNcHDQt','sdvx',4,'C3qHc_ayquL']);
      }

      sqliteConfirmColumns = await sqliteInit.all("PRAGMA TABLE_INFO('bot');");
      if (sqliteConfirmColumns[0].name === 'telegram_id'
        && sqliteConfirmColumns[1].name === 'is_registered'
        && sqliteConfirmColumns[2].name === 'registered_titles'
        && sqliteConfirmColumns[3].name === 'current_state'
        && sqliteConfirmColumns[4].name === 'last_command'
        && sqliteConfirmColumns[5].name === 'network_name'
        && sqliteConfirmColumns[6].name === 'network_id'
        && sqliteConfirmColumns[7].name === 'scores') {
        return ('DB_INIT_SUCCESS');
      }
  }
  return new Error('DB_INIT_FAILURE');
}

async function initApi(){
  let requestParameters = {
    url: API_ROOT,
    json: true,
    headers: AUTH_HEADER,
    gzip: true
  };
  try {
    const dataApiTopLevel = await rp(requestParameters);
    api.links = Object.values(dataApiTopLevel)[0];
    requestParameters.url = api.links.iidx;

    const dataApiButtons = await rp(requestParameters);
    let map = new Map();
    dataApiButtons._items.forEach((element) => {
      map.set(element.version, element);
    });

    api.iidx = [...map.entries()].reduce((obj, [key, value]) => (obj[key] = value, obj), {});
    requestParameters.url = api.links.sdvx;

    const dataApiKnobs = await rp(requestParameters);
    map.clear();
    dataApiKnobs._items.forEach((element) => {
      map.set(element.version, element);
    });
    api.sdvx = [...map.entries()].reduce((obj, [key, value]) => (obj[key] = value, obj), {});
  }
  catch (error) {
    throw error;
  }

  return 'API_INIT_SUCCESS';
}

async function initializeApplication() {
  let database;
  let apiStructure;

  try {
    database = await initializeDatabase();
  }
  catch (error) {
    console.info('Database initialization failed.');
    throw error
  }
  console.info('Database successfully initialized.');

  try {
    apiStructure = await initApi();
  }
  catch (error) {
    console.info('API initialization failed.');
    throw error;
  }
  console.info('API successfully initialized.');

  // console.log(api.sdvx[4]._links);

  if (database === 'DB_INIT_SUCCESS'
    && apiStructure === 'API_INIT_SUCCESS') return 'APP_INIT_SUCCESS';

  throw new Error('APP_INIT_FAILED');
}

async function getScore(options, url, currentScore = 0){

  const requestParameters = {
    url: url,
    json: true,
    headers: AUTH_HEADER,
    gzip: true
  };

  let score = currentScore;
  const data = await rp(requestParameters);
  for (let i = 0; i < data._items.length; i++) {
    if ((data._items[i].chart_id === options.chart_id) && (data._items[i].ex_score > score)) {
      score = data._items[i].ex_score;
    }
  }
  if (data._links._next) return getScore(options, data._links._next, score);
  return score;
}

async function getId(options, title) {
  let request;
  let url;
  if (title === 'IIDX') url = api.iidx[options.version]._links.profiles + `?dj_name=${options.player_name}`;
  else if (title === 'SDVX') url = api.sdvx[options.version]._links.profiles + `?name=${options.player_name}`;
  const requestParameters = {
    url: url,
    json: true,
    headers: AUTH_HEADER,
    gzip: true
  };
  try {
    request = await rp(requestParameters);
  }
  catch (error) {
    throw error;
  }
  if (request._items[0] === undefined) throw (new Error('NO_PLAYER_DATA'));
  else return (request._items[0]._id);
}

async function getPlayerData(options, title) {
  let id;

  try {
    id = await getId(options, title);
  }

  catch(error){
    if (error.toString() === 'Error: NO_PLAYER_DATA') return 1;
  }

  let request;
  let requestParameters = {};
  let playerData = {};

  if (title === 'IIDX'){
    requestParameters = {
      url: api.iidx[options.version]._links.profiles + `?_id=${id}`,
      json: true,
      headers: AUTH_HEADER,
      gzip: true
    };
    try {
      request = await rp(requestParameters);
    }
    catch (error) {
      throw error;
    }
    playerData = {
      dj_name: request._items[0].dj_name,
      iidx_id: request._items[0].iidx_id,
      sp_rank: request._items[0].sp.rank,
      dp_rank: request._items[0].dp.rank,
      sp_points: request._items[0].sp.dj_points,
      dp_points: request._items[0].dp.dj_points,
      network_id: id
    };

    for (let key in playerData) {
      if (playerData[key] === null) playerData[key]='No data';
    }
  }

  if (title === 'SDVX'){
    requestParameters = {
      url: api.sdvx[options.version]._links.profiles + `?_id=${id}`,
      json: true,
      headers: AUTH_HEADER,
      gzip: true
    };
    try {
      request = await rp(requestParameters);
    }
    catch (error) {
      throw error;
    }
    playerData = {
      name: request._items[0].name,
      sdvx_id: request._items[0].sdvx_id,
      network_id: id
    };

    for (let key in playerData) {
      if (playerData[key] === null) playerData[key]='No data';
    }
  }

  return playerData;
}


module.exports = {getId, getScore, initApi, getContestData, initializeApplication, initializeDatabase, 
                  sqlitePromise, getPlayerData, initUser, checkRegistry, updateState, getCurrentState, registerTitle, 
                  updateNetworkName, updateId, retrieveIdLocal, api, updateScore,currentScores, lastUpdate};
