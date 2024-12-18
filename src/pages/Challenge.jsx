import Animate from "../components/Animate";
import React, { useState, useEffect, useRef } from 'react';
import { Progress, Button, Dialog } from "@material-tailwind/react";
import { useDispatch, useSelector } from 'react-redux';
import { updateUser } from '../actions/user';
import { updateActivityWithUser } from '../actions/activity';
import { getItem } from '../actions/mine';
import { useNavigate } from 'react-router-dom';
import { UPDATE_ACTIVITY_WITH_USER, UPDATE_USER_WITH_LIFE, UPDATE_USER_WITH_ATTACK, UPDATE_USER_WITH_DEFENCE } from '../constants/activityConstants';
import TapButton from "../components/TapButton";
import UserInfo from "../components/UserInfo";
import BoostTouch from '../components/BoostTouch';

let timerInterval;
let sparkInterval;
let updateInterval;
let intervalCount = 0;

const Challenge = () => {
    const [tapLimit, setTapLimit] = useState(0);
    const [open, setOpen] = React.useState(false);
    const [mine, setMine] = useState(null);
    const [monster, setMonster] = useState(null);
    const [wins, setWins] = useState(0);
    const [earned, setEarned] = useState(0);
    const [battleTime, setBattleTime] = useState(0);
    const [manSparks, setManSparks] = useState([]);
    const [monsterSparks, setMonsterSparks] = useState([]);

    const [dlgShow, setDlgShow] = useState(true);
    const [isWin, setIsWin] = useState(0);
    const [plusAttr, setPlusAttr] = useState([0,0,0]);
    const boost = [ 40, 30, 100 ];
    const nav = useNavigate();

    const dispatch = useDispatch();
    const userData = useSelector((state) => state.user.user);
    const mineData = useSelector((state) => state.mine.items);
    const activityData = useSelector((state)=> state.activity.activity);
    const selMonster = useSelector((state) => state.other.fightMonster);
    const telegramId = useSelector((state)=> state.other.telegramId);
    const [counts, setCounts] = useState(0);

    const [pendingUpdates, setPendingUpdates] = useState({}); // For debouncing the API call
    const pendingUpdatesRef = useRef({});
    let lockUpdate = false;

    const shootManSpark = () => {
        setManSparks((prev) => [...prev, { id: Date.now(), position: 80 }]);
    };

    const shootMonsterSpark = () => {
        setMonsterSparks((prev) => [...prev, { id: Date.now(), position: 290 }]);
    };

    useEffect(() => {
        if (!isEmpty(activityData)) {
            setTapLimit(() => activityData.tapLimit);
        }
    }, [activityData]);

    useEffect(() => {
        let equipped = mineData.filter((item) => item.isWear);

        let attack = 0, defence = 0, health = 0, avatar = "";
        equipped.forEach((equip) => {
            if (equip.type == 'character') {health = equip.energy; avatar=equip.imageSrc;}
            else if (equip.type == 'attack') attack = equip.attribute;
            else if (equip.type == 'defence') defence = equip.attribute;
        });

        if (health < userData.energyLimit) health = userData.energyLimit;
        if (attack <= 0) attack = 3;
        if (defence <= 0) defence = 1;
        setCounts(userData.points);
        
        let user = {
            ...userData,
            curHealth: userData.currentEnergy,
            totalHealth: health,
            attack, defence, avatar
        };
        setMine(user);
    }, [userData, mineData]);
    
    useEffect(() => {
        if (!selMonster) return;

        let mon = {
            ...selMonster,
            curHealth: selMonster.energyLimit,
            totalHealth: selMonster.energyLimit,
            tokens: selMonster.tokenEarns,
            attack: selMonster.attack,
            defence: selMonster.defense,
        }
        setMonster(mon);
    }, [selMonster]);

    useEffect(() => {
        pendingUpdatesRef.current = pendingUpdates;
    }, [pendingUpdates]);

    useEffect(() => {
        updateInterval = setInterval(() => updateUserInfoToDB(), 3000);

        return () => {
            clearInterval(timerInterval);
            clearInterval(sparkInterval);
            clearInterval(updateInterval);
            updateUserInfoToDB();
        }
    }, []);

    useEffect(() => {
        if ((monster && monster.curHealth <= 0) || (mine && mine.curHealth <= 0)) {
            clearInterval(timerInterval);
            clearInterval(sparkInterval);

            if (mine.curHealth > 0) setIsWin(1);
            else                    setIsWin(2);

            setOpen(() => true);
        }
    }, [monster && monster.curHealth, mine && mine.curHealth])

    const updateUserInfoToDB = () => {
        if (Object.keys(pendingUpdatesRef.current).length > 0 && !lockUpdate) {
            dispatch(updateActivityWithUser({
                telegramId, 
                data_activity: pendingUpdatesRef.current,
            }, () => lockUpdate = false));
            setPendingUpdates({});
            lockUpdate = true;
        }
    }

    const startFighting = () => {
        if (!monster) return;

        setDlgShow(false);
        setBattleTime(() => 0);
        timerInterval = setInterval(() => setBattleTime((prev) => prev + 1), 1000);
        sparkInterval = setInterval(() => {
            manageSparks();
            intervalCount++;
            if (intervalCount >= 10) {
                shootMonsterSpark();
                intervalCount = 0;
            }
        }, 50);
    }
   
    const handleShoot = () => {
        if (tapLimit <= 0) return;
        shootManSpark();
        setTapLimit(prev => prev - 1);

        dispatch({
            type: UPDATE_ACTIVITY_WITH_USER,
            payload: {
              limit: tapLimit - 1,
              energy: mine.curHealth,
            }
        });
      
        const newUpdates = {
            ...pendingUpdatesRef.current,
            tapLimit: tapLimit - 1,
            points: counts + 1,
        };

        setPendingUpdates(newUpdates);
    };

    const manageSparks = () => {
        setManSparks((prev) => {
            let update = [];
            prev.forEach((spark) => {
                if (spark.position >= 290) {
                    let rand = Math.random();
                    let manAttack = Math.floor((mine.attack + plusAttr[0]) * 0.85 - monster.defence * (1 + rand));
                    if (manAttack < 0) manAttack = 1;
                    setMonster(cur => {
                        let curHealth = cur.curHealth - manAttack * 3;
                        if (curHealth < 0) curHealth = 0;
                        return {
                            ...cur,
                            curHealth,
                        }
                    });
                } else {
                    spark.position += 10;
                    update.push(spark);
                }
            });

            return update;
        });

        setMonsterSparks((prev) => {
            let update = [];
            prev.forEach((spark) => {
                if (spark.position <= 30) {
                    let rand = Math.random();
                    let monsterAttack = Math.floor(monster.attack + (1 + rand) - (mine.defence + plusAttr[1]) * 0.8);
                    if (monsterAttack < 0) monsterAttack = 1;

                    setMine(cur => {
                        let curHealth = cur.curHealth - monsterAttack * 3;
                        if (curHealth < 0) curHealth = 0;
                        const newUpdate = {
                            ...pendingUpdatesRef.current,
                            currentEnergy: curHealth,
                        };
                        setPendingUpdates(newUpdate);
                        dispatch({
                            type: UPDATE_ACTIVITY_WITH_USER,
                            payload: {
                              limit: tapLimit,
                              energy: curHealth,
                            }
                        });

                        return {
                            ...cur,
                            curHealth,
                        }
                    });
                } else {
                    spark.position -= 10;
                    update.push(spark);
                }
            });

            return update;
        });

    }

    const isEmpty = (val) => {
        if (!val) return true;
        if (Object.keys(val).length > 0) return false;
        if (val.length > 0) return false;
    
        return true;
    }

    const handleWinner = () => {
        let data = { 
            currentEnergy: mine.curHealth, 
            tokens: mine.tokens + monster.tokenEarns, 
            lastChallenge: monster.challengeIndex + 1, 
            levelIndex: userData.levelIndex, 
            pointsBalance: wins + 1, 
            tokensEarned: earned + monster.tokenEarns,
        };

        setOpen(() => false);
        dispatch(updateUser({ telegramId, data }));
        setDlgShow(() => true);
        setMonster(() => null);
    }

    const handleLoser = () => {
        let data = { 
            currentEnergy: mine.curHealth, 
            tokens: mine.tokens - monster.tokens, 
            lastChallenge: monster.challengeIndex, 
            levelIndex: userData.levelIndex,
        };

        dispatch(updateUser({ telegramId, data }));
        setOpen((cur) => !cur);
        nav('/home');
    }

    const doCancel = () => {
        nav('/home');
    }

    const handleAttack = () => {
        if(mine.attackItems <= 0) return;
        setPlusAttr((val) => {
            val[0] += boost[0];
            return val;
        });

        setMine(cur => {
            let curAttack = cur.attack + boost[0];
            let attackItems = cur.attackItems - 1;
            let data = { levelIndex: userData.levelIndex, attackItems: attackItems };
            dispatch(updateActivityWithUser({ telegramId, data_activity: data }));
            dispatch({
                type: UPDATE_USER_WITH_ATTACK,
                payload: {
                    attackItems: attackItems
                }
            });
            return {
                ...cur,
                curAttack,
                attackItems
            }
        });
    }

    const handleDefence = () => {
        if(mine.defenceItems <= 0) return;
        setPlusAttr((val) => {
            val[1] += boost[1];
            return val;
        });
        setMine(cur => {
            let curDefence = cur.defence + boost[1];
            let defenceItems = cur.defenceItems - 1;
            console.log("defenceItems", defenceItems);
            let data = { levelIndex: userData.levelIndex, defenceItems: defenceItems };
            dispatch(updateActivityWithUser({ telegramId, data_activity: data }));
            dispatch({
                type: UPDATE_USER_WITH_DEFENCE,
                payload: {
                    defenceItems: defenceItems
                }
            });
            return {
                ...cur,
                curDefence,
                defenceItems
            }
        });
    }

    const handleEnergy = () => {
        if(mine.lifeItems <= 0) return;
        setPlusAttr((val) => {
            val[2] += boost[2];
            return val;
        });
        setMine(cur => {
            let curHealth = (cur.curHealth + boost[2] > cur.totalHealth) ? cur.totalHealth : cur.curHealth + boost[2];
            let lifeItems = cur.lifeItems - 1;
            let data = { levelIndex: userData.levelIndex, lifeItems: lifeItems };
            dispatch(updateActivityWithUser({ telegramId, data_activity: data }));
            dispatch({
                type: UPDATE_USER_WITH_LIFE,
                payload: {
                    lifeItems: lifeItems
                }
            });
            return {
                ...cur,
                curHealth,
                lifeItems
            }
        });
    }

    return (
        <Animate>
            
            <div className="max-w-sm mx-auto bg-[#64ECEE55] bg-fixed text-white overflow-y-auto relative bg-[url('/assets/img/fields/6.png')] bg-cover bg-center min-h-screen">
                {
                dlgShow && 
                <div className="w-full h-full p-2 z-10 bg-[#000E] absolute bg-[url('/assets/img/bg_vs.png')] bg-cover bg-center min-h-screen">
                    <div className="bg-blue-gray-500top-0 left-0 z-40 p-2">
                        <div className="flex flex-center justify-between items-center mt-[20px] px-3">

                            <UserInfo color="red" user={mine} />
                            <UserInfo color='blue' user={{
                                ...monster,
                                avatar: '/assets/monster/monster1.png',
                                curHealth: monster && monster.energyLimit,
                                defence: monster && monster.defense,
                                tokens: monster && monster.tokenEarns,
                            }} />

                        </div>

                        <div className="flex justify-between p-4 mt-10">
                            <TapButton text="Fight" onClick={() => startFighting()} size="lg" />
                            <TapButton text="Cancel" onClick={() => doCancel()} size="lg" />
                        </div>

                    </div>
                </div>
                }

                <div className='mt-4 px-2'>
                    <div className="flex justify-between items-center">
                        <div className="p-2 w-full">
                            <div className="flex justify-between px-3">
                                <img src={mine && mine.avatar ? mine.avatar : "/assets/character/man1.png"} alt='avatar' className="w-[32px] h-[40px]"/>
                                <div>
                                    <div className='flex gap-1 items-center justify-end'>
                                        <img 
                                            src="/assets/img/loader.webp"
                                            alt='coin' 
                                            width="14px"
                                            height="14px"
                                        />
                                        <p className='text-yellow-600 font-bold text-[14px]'>{mine && mine.tokens}</p>
                                    </div>
                                    {plusAttr[2]!=0 ? <p className="mb-1 text-yellow-600 font-bold text-[14px]">{mine && (mine.curHealth + plusAttr[2])} / {mine && mine.totalHealth}</p>:<p className="mb-1 text-yellow-600 font-bold text-[14px]">{mine && mine.curHealth } / {mine && mine.totalHealth}</p>}
                                </div>
                            </div>
                            <Progress value={mine && (mine.curHealth / mine.totalHealth) * 100} className="bg-gray-200" color='red'/>
                            <div className="flex gap-5 mt-1">
                                <div className="flex gap-1">
                                    <img 
                                        src="/assets/challenge/attack.png"
                                        alt='coin' 
                                        width="14px"
                                        height="14px"
                                    />
                                    <p className='text-yellow-600 font-bold text-[14px]'>{mine && mine.attack}</p>
                                    {plusAttr[0]!=0 && <p className='text-yellow-600 font-bold text-[14px]'>+{plusAttr[0]}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <img 
                                        src="/assets/challenge/defence.png"
                                        alt='coin' 
                                        width="18px"
                                        height="14px"
                                    />
                                    <p className='text-yellow-600 font-bold text-[14px]'>{mine && mine.defence}</p>
                                    {plusAttr[1]!=0 && <p className='text-yellow-600 font-bold text-[14px]'>+{plusAttr[1]}</p>}
                                </div>
                            </div>
                        </div>
                        
                        <p className="border px-1">VS</p>
                        <div className="p-2 w-full">
                            <div className="flex justify-between px-3">
                                <div>
                                    <div className='flex gap-1 items-center'>
                                        <img 
                                            src="/assets/img/loader.webp"
                                            alt='coin' 
                                            width="14px"
                                            height="14px"
                                        />
                                        <p className='text-yellow-600 font-bold text-[14px]'>{monster && monster.tokens}</p>
                                    </div>
                                    <p className="mb-1 text-yellow-600 font-bold text-[14px]">{monster && monster.curHealth} / {monster && monster.totalHealth}</p>
                                </div>
                                <img src="/assets/monster/monster1.png" alt='avatar' className="w-[32px] h-[40px]"/>
                            </div>
                            <Progress value={monster && monster.curHealth / monster.totalHealth * 100} className="bg-gray-200" color='red'/>
                            <div className="flex gap-5 mt-1 justify-end">
                                <div className="flex gap-1">
                                    <img 
                                        src="/assets/challenge/attack.png"
                                        alt='coin' 
                                        width="14px"
                                        height="14px"
                                    />
                                    <p className='text-yellow-600 font-bold text-[14px]'>{monster && monster.attack}</p>
                                </div>
                                <div className="flex gap-1">
                                    <img 
                                        src="/assets/challenge/defence.png"
                                        alt='coin' 
                                        width="18px"
                                        height="14px"
                                    />
                                    <p className='text-yellow-600 font-bold text-[14px]'>{monster && monster.defence}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-center items-center">
                        <p className="text-[20px] font-bold">Battle Time Elapsed:</p>
                        <div style={{ textAlign: 'center'}}>
                            <div style={{ fontSize: '48px', fontWeight: 'bold' }}>
                                {Math.ceil(battleTime).toString().padStart(2, '0')}
                            </div>
                        </div>
                    </div>

                    <Dialog size="sm" open={open} className="bg-[#F47E5777]">
                       {isWin == 1?
                        <div className="flex flex-col justify-center">
                            <img src="/assets/challenge/winner.png" alt='winner' className="w-[120px] h-[180px] mx-auto mt-5"/>
                            <Button onClick={() => handleWinner()} className='py-5 px-8 text-[14px] w-[50%] mx-auto mt-5 mb-5'>
                                <div className="flex gap-2 justify-center items-center">
                                    <img src="/assets/img/loader.webp" alt='coin' className="w-[24px] h-[24px]"/>
                                    <p className="text-[18px]">{monster && monster.tokens}</p>
                                </div>
                            </Button>
                        </div>
                       :
                       <div className="flex flex-col justify-center">
                            <img src="/assets/challenge/loser.png" alt='winner' className="w-[120px] h-[180px] mx-auto mt-5"/>
                            <Button onClick={() => handleLoser()} className='py-5 px-8 text-[14px] w-[50%] mx-auto mt-5 mb-5'>Back Home</Button>
                        </div>
                       }
                    </Dialog>

                    <div className="flex justify-between relative h-[160px]">
                        <div className="flex gap-1">
                            <img src="/assets/challenge/man1.png" alt='character' className="w-[80px] h-[80px] block" style={{
                                position: 'absolute',
                                left: "10px",
                                bottom: '-10px',
                            }}/>
                            {manSparks.map((spark, idx) => (
                                <img key={idx} src='/assets/challenge/man_spark4.png' alt='character' className="w-[20px] h-[20px] block" style={{
                                    position: 'absolute',
                                    left: `${spark.position}px`,
                                    bottom: '40px',
                                }}/>
                            ))}
                        </div>
                        <div className="flex gap-1">
                            <img src="/assets/challenge/monster1.png" alt='character' className="w-[80px] h-[80px] block" style={{
                                position: 'absolute',
                                left: "280px",
                                bottom: '-10px',
                            }}/>
                            {monsterSparks.map((spark, idx) => (
                                <img key={idx} src='/assets/challenge/mon_spark.png' alt='character' className="w-[20px] h-[20px] block" style={{
                                    position: 'absolute',
                                    left: `${spark.position}px`,
                                    bottom: '53px',
                                }}/>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-[40px] px-4">
                        <BoostTouch
                            className="mt-[20px]"
                            onClick={handleAttack}
                            hidden={mine && mine.attackItems == 0}
                            src="/assets/weapon/weapon8.png"
                            unit={50}
                            value={mine && mine.attackItems} />
                        <BoostTouch
                            className="mt-[20px]" 
                            onClick={handleDefence}
                            hidden={mine && mine.defenceItems == 0}
                            src="/assets/shield/shield6.png"
                            unit={30}
                            value={mine && mine.defenceItems} />
                        <BoostTouch
                            className="mt-[20px]" 
                            onClick={handleEnergy}
                            hidden={mine && mine.lifeItems == 0}
                            src="/assets/img/heart.png"
                            unit={100}
                            value={mine && mine.lifeItems} />
                        <div className="flex gap-1 pl-7 items-center">
                            <img src="/assets/img/platinum.webp" alt='coin' className="w-[60px] h-[60px] cursor-pointer" onClick={handleShoot}/>
                            <div className="flex flex-col justify-center">
                                <p className="text-[36px] font-bold text-white">{tapLimit}</p>
                                <p className="text-[16px]">Tap Limits</p>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>
        </Animate>
    );
}

export default Challenge;
