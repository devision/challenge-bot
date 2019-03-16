"use strict";

const rp = require('request-promise-native');
const sqlite = require('sqlite');
const sqlitePromise = sqlite.open('./scoredata.sqlite');


const API_ROOT = process.env.API_ROOT;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const AUTH_HEADER = {Authorization: `Bearer ${AUTH_TOKEN}`};

let api = {};
let contest_options;

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

async function isRegistered(telegram_id){
  let sqliteInit;
  try {
    sqliteInit = await sqlitePromise;
  }
  catch (error){
    throw error;
  }

  let check = await sqliteInit.all('SELECT * FROM bot WHERE telegram_id = ?',[telegram_id]);
  if (check.length === 0) return false;
  else if (check[0].telegram_id === telegram_id.toString()) return true;
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
      await sqliteInit.all('INSERT INTO bot (telegram_id, current_state) VALUES(?, ?)',
      [telegram_id, 'INIT']);
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
    && (sqliteInit.driver.filename === './scoredata.sqlite')) {
      sqliteConfirmColumns = await sqliteInit.all("PRAGMA TABLE_INFO('scores');");
      sqliteConfirmBot = await sqliteInit.all("PRAGMA TABLE_INFO('bot');");
      sqliteConfirmContest = await sqliteInit.all("PRAGMA TABLE_INFO('contest');");
      if (sqliteConfirmColumns.length === 0 || 
          sqliteConfirmBot.length === 0 || 
          sqliteConfirmContest.length === 0) {
        await sqliteInit.all(
          'CREATE TABLE `scores` (`userid` TEXT NOT NULL UNIQUE, ' +
          '`username` TEXT, `handle` TEXT, `score` INTEGER, PRIMARY KEY(`userid`));'
        );
        await sqliteInit.all(
          'CREATE TABLE `bot` (' +
          '`telegram_id`  TEXT UNIQUE,' +
          '`is_registered`  INTEGER DEFAULT 0 ' +
          'CHECK(is_registered == 0 OR is_registered == 1),' +
          '`current_state`  TEXT DEFAULT \'NEW\' ' + 
          'CHECK(current_state == \'NEW\' OR current_state == \'INIT\' OR current_state == \'CONFIRM\'),' +
          'PRIMARY KEY(`telegram_id`));'
        );
        await sqliteInit.all(
          'CREATE TABLE `contest` (`title` TEXT,`version` INTEGER,`chart_id` TEXT);'
        );

      }
      sqliteConfirmColumns = await sqliteInit.all("PRAGMA TABLE_INFO('scores');");
      if (sqliteConfirmColumns[0].name === 'userid'
        && sqliteConfirmColumns[1].name === 'username'
        && sqliteConfirmColumns[2].name === 'handle'
        && sqliteConfirmColumns[3].name === 'score') {
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
  console.log(data._links._self);
  if (data._links._next) return getScore(options, data._links._next, score);
  console.log('Data updated');
  return score;
}

async function getId(options) {
  let request;
  const requestParameters = {
    url: api.iidx[options.version]._links.profiles + `?dj_name=${options.player_name}`,
    json: true,
    headers: AUTH_HEADER,
    gzip: true
  };
  try {
    request = await rp(requestParameters);
  }
  catch (error) {
    console.log(error);
    throw error;
  }
  if (request._items[0] === undefined) throw (new Error('NO_PLAYER_DATA'));
  else return (request._items[0]._id);
}

async function getPlayerData(options) {
  let id;

  try{
    id = await getId(options);
  }

  catch(error){
    if (error.toString() === 'Error: NO_PLAYER_DATA') return 1;

  }
  let request;
  const requestParameters = {
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
  const playerData = {
    dj_name: request._items[0].dj_name,
    iidx_id: request._items[0].iidx_id,
    sp_rank: request._items[0].sp.rank,
    dp_rank: request._items[0].dp.rank,
    sp_points: request._items[0].sp.dj_points,
    dp_points: request._items[0].dp.dj_points
  };

  for (let key in playerData) {
    if (playerData[key] === null) playerData[key]='No data';
  }
  return playerData;
}

async function playerData(options) {
  try {
    options.url = api.iidx[options.version]._links.player_bests;
    const id = await getId(options);
    options.profile_id = id;
    options.url = options.url + `?profile_id=${id}`;
    const score = await getScore(options, options.url);
    const sqliteInit = await sqlitePromise;
    sqlitePushScore = await sqliteInit.all('INSERT INTO scores (userid, username, score) VALUES(?, ?, ?)',
      [options.profile_id, options.player_name, score]);
  }

  catch (error) {
    throw error;
  }
}

module.exports = {getId, getScore, initApi, playerData, getContestData, initializeApplication, initializeDatabase, sqlitePromise, getPlayerData, initUser, isRegistered};