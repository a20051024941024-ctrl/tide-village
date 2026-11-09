module.exports = { viewport:{ width:1100, height:520 }, quality:'high', hash:'#hour=16&wx=sunny', ls:{ 'tide.guideDone': true, 'tide.rec': { total:50, coins:500 } },
  async run(p, shot){ await p.waitForTimeout(5000); console.log(await p.evaluate(() => __ev('JSON.stringify([me.pos.x, me.pos.z])'))); await shot('view'); } };
