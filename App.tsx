import React, {useCallback, useEffect, useRef, useState} from 'react';
import useSwipe from './hooks/useSwipe';
import type {CollectionAnimation, GameObject, GameStatus} from './types';
import {
    GAME_SPEED_START,
    INITIAL_LIVES,
    LANES,
    OBJECT_HEIGHT,
    OBJECT_SPAWN_INTERVAL,
    PLAYER_CAR_HEIGHT,
    ROAD_LINE_SPEED,
    WIN_SCORE
} from './constants';
import useSoundManager from './hooks/useSoundManager';
import {SoundOffIcon, SoundOnIcon} from './components/Icons';
import CakeIcon from './assets/cake.png';
import ConfettiIcon from './assets/confetti.png';
import ExplosionIcon from './assets/explosion.png';
import ParfIcon from './assets/parf.png';
import PlayerIcon from './assets/player.png';
import PlayerCarIcon from './assets/player-car.png';
import PoliceIcon from './assets/police.png';
import TetianaIcon from './assets/tetiana.png';
import PlayerWithCar from './assets/player-with-car.png';
import CarEngineSound from './assets/car-engine.mp3';
import CollectSound from './assets/collect.mp3';
import CrashSound from './assets/crash.mp3';
import GameOverSound from './assets/game-over.mp3';
import WinSound from './assets/win.mp3';

const soundUrls = {
    background: CarEngineSound,
    collect: CollectSound,
    crash: CrashSound,
    gameOver: GameOverSound,
    win: WinSound,
};

const Modal = ({title, message, buttonText, onButtonClick, imageUrl}: {
    title: string;
    message: string;
    buttonText: string;
    onButtonClick: () => void;
    imageUrl?: string;
}) => (
    <div
        className="absolute inset-0 bg-black flex flex-col justify-center items-center z-30 text-center p-4">
        {imageUrl && (
            <img
                src={imageUrl}
                alt={title}
                className="w-32 h-32 object-contain rounded-lg mb-4"
            />
        )}
        <h2 className="text-5xl font-bold text-yellow-400 mb-4"
            style={{WebkitTextStroke: '2px red', textShadow: '3px 3px 0 #000'}}>{title}</h2>
        <p className="text-white text-xl mb-8">{message}</p>
        <button
            onClick={onButtonClick}
            className="bg-yellow-400 text-slate-800 font-bold py-3 px-8 rounded-lg text-2xl shadow-lg hover:bg-yellow-300 transition-transform transform hover:scale-105"
        >
            {buttonText}
        </button>
    </div>
);

const RoadLine = React.memo(({left, top}: { left: string; top: number; }) => (
    <div
        className="absolute w-2 md:w-4 h-8 md:h-16 bg-yellow-400"
        style={{left, top: `${top}px`, transform: 'translateX(-50%)'}}
    />
));

const GameObjectDisplay = React.memo(({object, gameWidth}: { object: GameObject; gameWidth: number; }) => {
    const laneWidth = gameWidth / LANES;
    const style = {
        left: `${(object.lane * laneWidth) + (laneWidth / 2)}px`,
        top: `${object.top}px`,
        transform: 'translateX(-50%)',
    };

    return (
        <div className="absolute w-16 h-20" style={style}>
            {object.type === 'police'
                ? <img src={PoliceIcon} alt="Police" className="w-full h-full object-contain rounded-lg"/>
                : <img src={CakeIcon} alt="Collectible" className="w-full h-full object-contain rounded-lg"/>}
        </div>
    );
});

const CollectionAnimationDisplay = React.memo(({animation, gameWidth}: {
    animation: CollectionAnimation;
    gameWidth: number;
}) => {
    const laneWidth = gameWidth / LANES;
    const style = {
        left: `${(animation.lane * laneWidth) + (laneWidth / 2)}px`,
        top: `${animation.top}px`,
        transform: 'translateX(-50%)',
    };

    return (
        <div className="absolute w-16 h-20 pointer-events-none z-20 flex justify-center items-center" style={style}>
            <img
                src={ConfettiIcon}
                alt="Collected"
                className="w-24 h-24 animate-explode object-contain rounded-full"
            />
        </div>
    );
});


function App() {
    const [status, setStatus] = useState<GameStatus>('start');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(INITIAL_LIVES);
    const [playerLane, setPlayerLane] = useState(1);
    const [tick, setTick] = useState(0);
    const [isColliding, setIsColliding] = useState(false);
    const [collectedCakes, setCollectedCakes] = useState<CollectionAnimation[]>([]);
    const [isMuted, setIsMuted] = useState(false);


    const gameAreaRef = useRef<HTMLDivElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const frameCount = useRef(0);
    const gameSpeed = useRef(GAME_SPEED_START);
    const objects = useRef<GameObject[]>([]);
    const roadLines = useRef<Array<{ id: number; top: number }>>([]);
    const playerLaneRef = useRef(playerLane);
    const collisionTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {playSound, stopAllSounds} = useSoundManager(soundUrls, isMuted);


    useEffect(() => {
        playerLaneRef.current = playerLane;
    }, [playerLane]);

    const initGameAssets = useCallback(() => {
        if (gameAreaRef.current) {
            const gameHeight = gameAreaRef.current.offsetHeight;
            roadLines.current = Array.from({length: 5}, (_, i) => ({
                id: i,
                top: i * (gameHeight / 4),
            }));
        }
    }, []);

    useEffect(() => {
        initGameAssets();
        const resizeObserver = new ResizeObserver(initGameAssets);
        if (gameAreaRef.current) {
            resizeObserver.observe(gameAreaRef.current);
        }
        return () => resizeObserver.disconnect();
    }, [initGameAssets]);

    const resetGame = useCallback(() => {
        stopAllSounds();
        playSound('start');
        playSound('background', true);
        setStatus('playing');
        setScore(0);
        setLives(INITIAL_LIVES);
        setPlayerLane(1);
        playerLaneRef.current = 1;
        objects.current = [];
        setCollectedCakes([]);
        gameSpeed.current = GAME_SPEED_START;
        frameCount.current = 0;
        initGameAssets();
    }, [initGameAssets, playSound, stopAllSounds]);

    const movePlayer = useCallback((direction: 'left' | 'right') => {
        setPlayerLane(prevLane => {
            if (direction === 'left') return Math.max(0, prevLane - 1);
            return Math.min(LANES - 1, prevLane + 1);
        });
    }, []);

    const moveLeft = useCallback(() => movePlayer('left'), [movePlayer]);
    const moveRight = useCallback(() => movePlayer('right'), [movePlayer]);

    useSwipe(moveLeft, moveRight);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status === 'playing') {
                if (e.key === 'ArrowLeft') moveLeft();
                if (e.key === 'ArrowRight') moveRight();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (status !== 'playing') {
                    resetGame();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, resetGame, moveLeft, moveRight]);

    const gameLoop = useCallback(() => {
        if (status !== 'playing' || !gameAreaRef.current) return;

        const gameHeight = gameAreaRef.current.offsetHeight;

        roadLines.current = roadLines.current.map(line => ({
            ...line,
            top: (line.top + ROAD_LINE_SPEED) % (gameHeight + 100) > gameHeight ? -100 : line.top + ROAD_LINE_SPEED
        }));

        frameCount.current++;
        const currentLane = playerLaneRef.current;

        objects.current = objects.current.map(obj => ({...obj, top: obj.top + gameSpeed.current})).filter(obj => {
            const playerTop = gameHeight - PLAYER_CAR_HEIGHT;
            const objectBottom = obj.top + OBJECT_HEIGHT;

            if (obj.lane === currentLane && objectBottom > playerTop && obj.top < gameHeight) {
                if (obj.type === 'police') {
                    playSound('crash');
                    setLives(prev => Math.max(0, prev - 1));
                    if (collisionTimeoutId.current) clearTimeout(collisionTimeoutId.current);
                    setIsColliding(true);
                    collisionTimeoutId.current = setTimeout(() => setIsColliding(false), 400);
                } else {
                    playSound('collect');
                    setScore(prev => prev + 1);
                    const animationId = Date.now() + Math.random();
                    setCollectedCakes(prev => [...prev, {id: animationId, lane: obj.lane, top: obj.top}]);
                    setTimeout(() => {
                        setCollectedCakes(prev => prev.filter(a => a.id !== animationId));
                    }, 600);
                }
                return false;
            }
            return obj.top < gameHeight;
        });

        if (frameCount.current % OBJECT_SPAWN_INTERVAL === 0) {
            const occupiedLanes = objects.current.filter(obj => obj.top < OBJECT_HEIGHT * 2).map(obj => obj.lane);
            if (occupiedLanes.length < LANES) {
                let newLane;
                do {
                    newLane = Math.floor(Math.random() * LANES);
                } while (occupiedLanes.includes(newLane));
                objects.current.push({
                    id: Date.now() + Math.random(),
                    lane: newLane,
                    top: -OBJECT_HEIGHT,
                    type: Math.random() > 0.35 ? 'police' : 'cake'
                });
            }
        }

        gameSpeed.current += 0.002;
        setTick(t => t + 1);
        animationFrameId.current = requestAnimationFrame(gameLoop);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, playSound]);

    useEffect(() => {
        if (status === 'playing') {
            animationFrameId.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [status, gameLoop]);

    useEffect(() => {
        if (lives <= 0) {
            setStatus('gameOver');
            stopAllSounds();
            playSound('gameOver');
        }
    }, [lives, playSound, stopAllSounds]);

    useEffect(() => {
        if (score >= WIN_SCORE) {
            setStatus('won');
            stopAllSounds();
            playSound('win');
        }
    }, [score, playSound, stopAllSounds]);

    const lanePositions = ['16.666%', '50%', '83.333%'];
    const gameWidth = gameAreaRef.current?.offsetWidth ?? 0;

    const getModalImageUrl = () => {
        if (status === 'gameOver') {
            return TetianaIcon;
        }
        if (status === 'won') {
            return ParfIcon;
        }

        if (status === 'start') {
            return PlayerWithCar;
        }

        return undefined;
    };

    return (
        <div
            className="bg-green-700 w-screen h-screen flex flex-col items-center justify-center font-mono overflow-hidden select-none touch-none">
            <div className="w-full max-w-md mx-auto text-white p-2">
                <h1 className="text-4xl md:text-5xl font-bold text-center text-yellow-400 mb-2"
                    style={{WebkitTextStroke: '2px red', textShadow: '3px 3px 0 #000'}}>
                    Vova Deviatka
                </h1>
                <div className="flex justify-between items-center text-xl md:text-2xl px-4">
                    <div className="font-bold flex items-center gap-2">
                        <img
                            src={CakeIcon}
                            alt="Score"
                            className="w-8 h-8 object-cover rounded-full"
                        />
                        <span>{score}</span>
                    </div>
                    <div className="flex items-center gap-4 font-bold">
                        <div className="flex items-center gap-2">
                            <span>{lives}</span>
                            <img
                                src={PlayerIcon}
                                alt="Life"
                                className="w-8 h-8 inline-block rounded-full border-2 border-white"
                            />
                        </div>
                        <button
                            onClick={() => setIsMuted(prev => !prev)}
                            className="text-white p-1 rounded-full hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                        >
                            {isMuted ? <SoundOffIcon/> : <SoundOnIcon/>}
                        </button>
                    </div>
                </div>
            </div>

            <div ref={gameAreaRef}
                 className="relative w-full max-w-md h-[80vh] max-h-[900px] bg-slate-700 overflow-hidden shadow-2xl border-8 border-slate-900">
                {status !== 'playing' && (
                    <Modal
                        title={status === 'start' ? "" : (status === 'gameOver' ? "Game Over" : "You Win!")}
                        message={status === 'start' ? "Не має значення, що ти стоїш біля тачки і вона твоя. Важливо інше: як ти на ній їздиш! Запам'ятай це!" : (status === 'gameOver' ? `Your final score: ${score}` : "Congratulations! You are a true racer.")}
                        buttonText={status === 'start' ? "Поїхали" : "Play Again"}
                        onButtonClick={resetGame}
                        imageUrl={getModalImageUrl()}
                    />
                )}

                {roadLines.current.map(line => <RoadLine key={line.id} left="33.33%" top={line.top}/>)}
                {roadLines.current.map(line => <RoadLine key={line.id + 10} left="66.67%" top={line.top}/>)}

                {objects.current.map(obj => (<GameObjectDisplay key={obj.id} object={obj} gameWidth={gameWidth}/>))}
                {collectedCakes.map(anim => (
                    <CollectionAnimationDisplay key={anim.id} animation={anim} gameWidth={gameWidth}/>))}


                {status === 'playing' && (
                    <div
                        className={`absolute bottom-4 w-16 h-20 transition-all duration-100 ease-linear ${isColliding ? 'animate-crash' : ''}`}
                        style={{left: lanePositions[playerLane], transform: 'translateX(-50%)'}}
                    >
                        <img
                            src={PlayerCarIcon}
                            alt="Player"
                            className="w-full h-full object-contain rounded-lg"
                        />
                        {isColliding && (
                            <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                                <img
                                    src={ExplosionIcon}
                                    alt="Crash"
                                    className="w-24 h-24 animate-explode object-cover rounded-full"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;