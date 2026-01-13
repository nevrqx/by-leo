const state = {
    currentView: 'texts', // 'rules', 'words', 'texts', 'etc', 'reader'
    currentLecture: null,
    lastView: 'texts' // Default fallback
};

// Элементы DOM
const views = {
    rules: document.getElementById('rules-view'),
    words: document.getElementById('words-view'),
    texts: document.getElementById('texts-view'),
    tasks: document.getElementById('tasks-view'),
    reader: document.getElementById('lecture-reader'),
    // Profile view might be removed or hidden
    profile: document.getElementById('profile-view')
};

const navButtons = {
    rules: document.getElementById('nav-rules'),
    words: document.getElementById('nav-words'),
    texts: document.getElementById('nav-texts'),
    tasks: document.getElementById('nav-tasks'),
    // Profile button is not interactive via switchTab in the new design
    profile: document.getElementById('nav-profile')
};

const lectureBody = document.getElementById('lecture-body');

// Функция переключения вкладок
// Функция переключения вкладок
function switchTab(tabName) {
    // Force hide overlays (Reader and Quiz)
    if (views.reader) {
        views.reader.classList.remove('visible');
        views.reader.classList.add('hidden');
    }

    const taskPlayer = document.getElementById('task-player');
    if (taskPlayer) {
        taskPlayer.classList.remove('visible');
        taskPlayer.classList.add('hidden');
    }

    // Скрываем все views
    Object.values(views).forEach(el => {
        if (el) {
            el.classList.remove('visible');
            el.classList.add('hidden');
        }
    });

    // Показываем нужный
    if (views[tabName]) {
        views[tabName].classList.remove('hidden');
        views[tabName].classList.add('visible');
    }

    // Обновляем кнопки навигации
    Object.values(navButtons).forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    if (navButtons[tabName]) {
        navButtons[tabName].classList.add('active');
    }

    state.currentView = tabName;
    window.scrollTo(0, 0);
}

// Функция открытия лекции (или правила/текста)
function openLecture(filename) {
    // Save the current view to return to it later
    if (state.currentView !== 'reader') {
        state.lastView = state.currentView;
    }

    // Hide all main views
    Object.values(views).forEach(el => {
        if (el && el.id !== 'lecture-reader') {
            el.classList.remove('visible');
            el.classList.add('hidden');
        }
    });

    views.reader.classList.remove('hidden');
    views.reader.classList.add('visible');

    const script = document.createElement('script');
    script.src = `lection/${filename}`;
    script.onload = () => {
        console.log(`Content ${filename} loaded`);
    };
    script.onerror = () => {
        // Fallback or error msg
        lectureBody.innerHTML = '<p style="color: red; padding: 20px;">Ошибка загрузки материала.</p>';
    };
    document.body.appendChild(script);

    state.currentView = 'reader';
    window.scrollTo(0, 0);
}

// Функция возврата к списку
function showMain() {
    views.reader.classList.remove('visible');
    views.reader.classList.add('hidden');

    // Return to the last known view, or default to 'rules' if unknown
    // (since Rules is the default home for lectures usually)
    const targetView = state.lastView || 'rules';
    switchTab(targetView);
}

// Глобальная функция, которую вызывает файл лекции
window.loadLectureContent = function (title, contentHTML) {
    document.getElementById('reader-title').textContent = title;
    document.getElementById('lecture-body').innerHTML = contentHTML;

    // Render MathJax
    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }

    if (window.feather) {
        feather.replace();
    }
};

// --- Quiz Engine & Persistence ---
const QuizManager = {
    state: {
        currentQuizId: null,
        dataset: [],
        currentIndex: 0,
        score: 0,
        mistakes: [], // Array of question objects
    },

    // Safe localStorage wrapper
    storage: {
        get(key) {
            try {
                return JSON.parse(localStorage.getItem(key));
            } catch (e) {
                console.warn('Storage access failed:', e);
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn('Storage save failed:', e);
            }
        }
    },

    // Load progress
    getHistory() {
        return this.storage.get('quiz_history') || {};
    },

    saveHistory(quizId, score, total, mistakes) {
        const history = this.getHistory();
        history[quizId] = { score, total, date: Date.now() };

        // Save mistakes globally
        let globalMistakes = this.storage.get('global_mistakes') || [];

        // Add new mistakes, avoiding duplicates
        mistakes.forEach(m => {
            if (!globalMistakes.some(gm => gm.question === m.question)) {
                globalMistakes.push({ ...m, sourceQuiz: quizId });
            }
        });

        this.storage.set('quiz_history', history);
        this.storage.set('global_mistakes', globalMistakes);

        this.updateStatsUI();
    },

    updateStatsUI() {
        const history = this.getHistory();
        const totalQuizzes = Object.keys(history).length;
        const totalScore = Object.values(history).reduce((acc, val) => acc + val.score, 0);

        // Update dashboard if exists
        const statsContainer = document.getElementById('quiz-stats-display');
        if (statsContainer) {
            if (totalQuizzes === 0) {
                statsContainer.innerHTML = `
                    <div style="text-align:center; padding: 20px; opacity: 0.6; font-size: 14px;">
                        Проходите тесты, чтобы увидеть статистику
                    </div>
                 `;
            } else {
                statsContainer.innerHTML = `
                    <div style="display:flex; gap:16px; justify-content:center; margin-bottom:24px;">
                        <div style="background:rgba(255,255,255,0.05); padding:12px 20px; border-radius:16px;">
                            <div style="font-size:12px; opacity:0.7">Пройдено тестов</div>
                            <div style="font-size:20px; font-weight:700">${totalQuizzes}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); padding:12px 20px; border-radius:16px;">
                            <div style="font-size:12px; opacity:0.7">Общий счет</div>
                            <div style="font-size:20px; font-weight:700; color:var(--accent-green, #10b981)">${totalScore}</div>
                        </div>
                    </div>
                `;
            }
        }

        // Show/Hide "Work on Mistakes" button
        const mistakes = this.storage.get('global_mistakes') || [];
        const mistakesBtn = document.getElementById('btn-mistakes');
        if (mistakesBtn) {
            if (mistakes.length > 0) {
                mistakesBtn.classList.remove('hidden');
                mistakesBtn.querySelector('.lecture-desc').textContent = `${mistakes.length} вопросов требуют внимания`;
            } else {
                mistakesBtn.classList.add('hidden');
            }
        }
    }
};

const currentQuizInstructions = null;

function openTask(filename) {
    const script = document.createElement('script');
    script.src = `question/${filename}`;
    script.onload = () => console.log(`Task ${filename} loaded`);
    script.onerror = () => alert('Ошибка загрузки задания');
    document.body.appendChild(script);
}

function openWordList(filename) {
    // Hide all main views
    Object.values(views).forEach(el => {
        if (el) {
            el.classList.remove('visible');
            el.classList.add('hidden');
        }
    });

    // Show player (GameManager uses task-player)
    document.getElementById('task-player').classList.remove('hidden');
    document.getElementById('task-player').classList.add('visible');

    const script = document.createElement('script');
    script.src = `words/${filename}`;
    script.onload = () => console.log(`Words ${filename} loaded`);
    script.onerror = () => alert('Ошибка загрузки слов');
    document.body.appendChild(script);
}

window.loadVocabulary = function (title, words) {
    const container = document.getElementById('task-player');

    // Show player view (reused as generic container)
    container.classList.remove('hidden');
    container.classList.add('visible');

    // Hide words list view if visible
    if (views.words) {
        views.words.classList.remove('visible');
        views.words.classList.add('hidden');
    }

    let listHTML = words.map(w => `
        <div class="word-item" style="
            padding: 16px; 
            border-bottom: 1px solid rgba(255,255,255,0.05); 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            gap: 20px;
        ">
            <div style="flex: 1; text-align: left; font-weight: 500; font-size: 16px; color: #fff; line-height: 1.4;">${w.word}</div>
            <div style="flex: 1; text-align: right; opacity: 0.6; font-size: 15px; line-height: 1.4;">${w.translation}</div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="repo-header quiz-header" style="
            margin-bottom: 20px; 
            display: flex; 
            align-items: center; 
            position: sticky; 
            top: 0; 
            background: var(--bg-dark); 
            z-index: 10; 
            padding-bottom: 10px; 
            border-bottom: 1px solid rgba(255,255,255,0.05);
        ">
            <button class="back-btn" onclick="closeQuiz()" style="margin-right: 16px;">
                <i data-feather="arrow-left"></i>
            </button>
            <div style="flex: 1;">
                <div class="reader-header-title" style="font-size: 18px;">${title}</div>
                <div style="font-size: 13px; opacity: 0.5;">${words.length} слов</div>
            </div>
        </div>
        <div class="word-list-container" style="padding-bottom: 80px;">
            ${listHTML}
        </div>
    `;

    if (window.feather) feather.replace();
};

// --- Formula Matching Game Engine ---
const GameManager = {
    state: {
        cards: [],
        selectedCard: null,
        matchesFound: 0,
        totalPairs: 0,
        isLocked: false // Prevent clicking while animating
    },

    startGame(data) {
        // Prepare game data: take 10 random pairs (20 cards) for "more" challenge
        // Ensure shuffleArray is available
        const shuffledData = shuffleArray(data).slice(0, 10);

        let cards = [];
        shuffledData.forEach(item => {
            // Create two cards for each item: one formula, one name
            cards.push({ id: item.id, content: item.formula, type: 'formula', isMatched: false });
            cards.push({ id: item.id, content: item.name, type: 'name', isMatched: false });
        });

        // Shuffle the cards on the board
        this.state.cards = shuffleArray(cards);
        this.state.matchesFound = 0;
        this.state.totalPairs = shuffledData.length;
        this.state.selectedCard = null;
        this.state.isLocked = false;

        // Switch View
        document.getElementById('task-player').classList.remove('hidden');
        document.getElementById('task-player').classList.add('visible');

        // views.tasks is undefined in new structure, handled by openWordList
        if (views.words) {
            views.words.classList.remove('visible');
            views.words.classList.add('hidden');
        }

        this.renderGrid();
    },

    renderGrid() {
        const container = document.getElementById('task-player');

        // Generate Cards HTML
        let cardsHTML = this.state.cards.map((card, index) => {
            const visibilityClass = card.isMatched ? 'invisible' : '';
            const selectedClass = (this.state.selectedCard && this.state.selectedCard.index === index) ? 'selected' : '';

            // Adjust font size for longer text
            const textStyle = card.content.length > 20 ? 'font-size:14px;' : 'font-size:18px;';

            return `
                <div class="game-card ${visibilityClass} ${selectedClass}" 
                     onclick="handleGameCardClick(${index})"
                     style="${textStyle}">
                    ${card.content}
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="repo-header quiz-header" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                <button class="back-btn" onclick="closeQuiz()">
                    <i data-feather="arrow-left"></i>
                </button>
                <div style="text-align:center;">
                    <div class="reader-header-title">Найди Пару</div>
                    <div style="font-size:13px; opacity:0.7">Найдено: ${this.state.matchesFound} / ${this.state.totalPairs}</div>
                </div>
                <div style="width:40px;"></div> <!-- Spacer -->
            </div>
            
            <div class="game-grid">
                ${cardsHTML}
            </div>
        `;
        if (window.feather) feather.replace();
    },

    handleCardClick(index) {
        if (this.state.isLocked) return;

        const card = this.state.cards[index];
        if (card.isMatched) return;

        // If clicking the same card
        if (this.state.selectedCard && this.state.selectedCard.index === index) {
            this.state.selectedCard = null;
            this.renderGrid();
            return;
        }

        // Select first card
        if (!this.state.selectedCard) {
            this.state.selectedCard = { ...card, index };
            this.renderGrid();
            return;
        }

        // Compare with second card
        const first = this.state.selectedCard;
        const second = { ...card, index };

        if (first.id === second.id) {
            // Match!
            this.state.cards[first.index].isMatched = true;
            this.state.cards[second.index].isMatched = true;
            this.state.matchesFound++;
            this.state.selectedCard = null;
            this.renderGrid();

            if (this.state.matchesFound === this.state.totalPairs) {
                setTimeout(() => this.finishGame(), 500);
            }
        } else {
            // Mismatch
            // Visual highlight for mismatch would be good, here we use timeout
            this.state.isLocked = true;

            // Re-render to show second selection
            // We need to manually add 'wrong' class via DOM to avoid full re-render flickering or complex state
            const grids = document.querySelectorAll('.game-card');
            if (grids[first.index]) grids[first.index].classList.add('wrong');
            if (grids[second.index]) grids[second.index].classList.add('wrong');

            setTimeout(() => {
                if (grids[first.index]) grids[first.index].classList.remove('wrong');
                if (grids[second.index]) grids[second.index].classList.remove('wrong');
                this.state.selectedCard = null;
                this.state.isLocked = false;
                this.renderGrid();
            }, 800);
        }
    },

    finishGame() {
        const container = document.getElementById('task-player');
        container.innerHTML = `
            <div class="quiz-result-card">
                <i data-feather="check-circle" style="width:64px; height:64px; color:#10b981; margin-bottom:16px;"></i>
                <h2>Отлично!</h2>
                <p style="opacity:0.8; margin-bottom:24px;">Вы нашли все пары.</p>
                <button class="quiz-btn primary" onclick="closeQuiz()">Вернуться</button>
                <button class="quiz-btn" onclick="openTask('formulas.js')" style="background:transparent; border:1px solid rgba(255,255,255,0.2); margin-top:12px; color:#fff;">Сыграть еще раз</button>
            </div>
        `;
        if (window.feather) feather.replace();
    }
};

window.loadFormulaData = function (data) {
    GameManager.startGame(data);
};

window.handleGameCardClick = function (index) {
    GameManager.handleCardClick(index);
};

window.loadQuizData = function (title, questions) {
    startQuiz(title, questions);
};

function startQuiz(title, questions, isMistakesMode = false) {
    // Shuffle questions for randomness
    const shuffledQuestions = shuffleArray([...questions]);

    QuizManager.state = {
        currentQuizId: title,
        dataset: shuffledQuestions,
        currentIndex: 0,
        score: 0,
        mistakes: []
    };

    // Toggle Views
    document.getElementById('task-player').classList.remove('hidden');
    document.getElementById('task-player').classList.add('visible');

    if (views.words) {
        views.words.classList.remove('visible');
        views.words.classList.add('hidden');
    }

    renderQuizStep(isMistakesMode);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function renderQuizStep(isMistakesMode) {
    const { dataset, currentIndex, score } = QuizManager.state;
    const container = document.getElementById('task-player');

    // Progress Bar
    const progress = ((currentIndex) / dataset.length) * 100;

    if (currentIndex >= dataset.length) {
        // Finish Quiz
        finishQuiz(isMistakesMode);
        return;
    }

    const q = dataset[currentIndex];

    let optionsHTML = '';
    q.options.forEach((opt, idx) => {
        optionsHTML += `<button class="quiz-option" onclick="handleAnswer(${idx})">${opt}</button>`;
    });

    container.innerHTML = `
        <div class="reader-header" style="position:static; margin-bottom:20px; justify-content: space-between;">
             <button class="back-btn" onclick="closeQuiz()">
                <i data-feather="arrow-left"></i>
            </button>
            <div class="reader-header-title">${QuizManager.state.currentQuizId}</div>
            <div style="font-size:14px; font-weight:600; color:var(--accent-blue)">${currentIndex + 1}/${dataset.length}</div>
        </div>
        
        <!-- Progress Bar -->
        <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-bottom:24px; overflow:hidden;">
            <div style="width:${progress}%; height:100%; background:var(--accent-blue); transition:width 0.3s;"></div>
        </div>
        
        <div class="quiz-card">
            <h3 class="quiz-question">${q.question}</h3>
            <div class="quiz-options">
                ${optionsHTML}
            </div>
        </div>
    `;
    feather.replace();
}

window.handleAnswer = function (selectedIndex) {
    const state = QuizManager.state;
    const q = state.dataset[state.currentIndex];
    const options = document.querySelectorAll('.quiz-option');

    options.forEach(btn => btn.disabled = true);

    if (selectedIndex === q.correct) {
        options[selectedIndex].classList.add('correct');
        state.score++;

        // If in mistakes mode, remove this from global mistakes
        if (state.currentQuizId === 'Работа над ошибками') {
            removeFromGlobalMistakes(q.question);
        }
    } else {
        options[selectedIndex].classList.add('wrong');
        options[q.correct].classList.add('correct');
        state.mistakes.push(q);
    }

    setTimeout(() => {
        state.currentIndex++;
        renderQuizStep(state.currentQuizId === 'Работа над ошибками');
    }, 1500);
};

function finishQuiz(isMistakesMode) {
    const { currentQuizId, score, dataset, mistakes } = QuizManager.state;

    // Save Result
    if (!isMistakesMode) {
        QuizManager.saveHistory(currentQuizId, score, dataset.length, mistakes);
    } else {
        // Just refresh stats
        QuizManager.updateStatsUI();
    }

    const container = document.getElementById('task-player');
    const percentage = Math.round((score / dataset.length) * 100);
    let message = "Неплохо!";
    if (percentage === 100) message = "Идеально! 🏆";
    if (percentage < 50) message = "Нужно подучить...";

    container.innerHTML = `
        <div class="repo-header quiz-header">
            <button class="back-btn" onclick="closeQuiz()">
                <i data-feather="arrow-left"></i>
            </button>
            <h2>Результат</h2>
        </div>
        <div class="quiz-result-card">
            <div class="quiz-score">${score} / ${dataset.length}</div>
            <p style="font-size:18px; color:#fff; margin-bottom:8px;">${message}</p>
            <p style="font-size:14px; opacity:0.7">Ошибок: ${mistakes.length}</p>
            <button class="quiz-btn primary" onclick="closeQuiz()">Вернуться к заданиям</button>
        </div>
    `;
    feather.replace();
}

function removeFromGlobalMistakes(questionText) {
    let globalMistakes = QuizManager.storage.get('global_mistakes') || [];
    globalMistakes = globalMistakes.filter(m => m.question !== questionText);
    QuizManager.storage.set('global_mistakes', globalMistakes);
}

// Special Modes
window.startMistakesQuiz = function () {
    const mistakes = QuizManager.storage.get('global_mistakes') || [];
    if (mistakes.length === 0) {
        alert("Ошибок пока нет! Вы молодец.");
        return;
    }
    // Shuffle
    const shuffled = mistakes.sort(() => 0.5 - Math.random()).slice(0, 15);
    startQuiz("Работа над ошибками", shuffled, true);
};

window.startBlitzQuiz = function () {
    // We need to fetch all questions. This is tricky without a backend.
    // Hack: Load all known quiz files? Or just rely on what we can.
    // For now, let's just make Blitz a placeholder or load a specific 'blitz' file.
    // Or better: The user loads specific quizzes.
    // Let's postpone true random blitz until we can preload all JS files.
    // Simple Blitz: Load Thermodynamics again mixed?
    // Let's disable Blitz for now or make it specific.
    alert("Блиц-режим: Скоро будет доступен (формируется база вопросов).");
};

window.closeQuiz = function () {
    document.getElementById('task-player').classList.remove('visible');
    document.getElementById('task-player').classList.add('hidden');

    // Return to Words view
    switchTab('words');

    QuizManager.updateStatsUI();
};

// Initial Stats Load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(QuizManager.updateStatsUI, 500);
});

// Защита от копирования и зума
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', event => {
    // Запрет F12, Ctrl+U, Ctrl+S, Ctrl+C и т.д. может раздражать, но сделаем базовый
    if (event.ctrlKey && (event.key === 'u' || event.key === 's' || event.key === 'c')) {
        event.preventDefault();
    }
});


// --- Sentence Builder Feature ---
const SentenceBuilder = {
    levels: [
        { id: 'sb_level1.js', title: 'Уровень 1 (Основы)' },
        { id: 'sb_level2.js', title: 'Уровень 2 (Порядок слов)' },
        { id: 'sb_level3.js', title: 'Уровень 3 (Сложные)' },
        { id: 'sb_level4.js', title: 'Уровень 4 (Эксперт)' },
        { id: 'sb_level5.js', title: 'Уровень 5 (Мастер)' }
    ],
    state: {
        currentLevelTitle: '',
        data: [],
        currentIndex: 0,
        currentSentence: null,
        words: [], // { id, text, location: 'pool'|'answer' }
        isCompleted: false,
        score: 0
    },

    init() {
        const container = document.getElementById('task-player');
        container.classList.remove('hidden');
        container.classList.add('visible');

        const levelListHTML = this.levels.map(l => `
            <div class="lecture-item" onclick="SentenceBuilder.loadLevel('${l.id}', '${l.title}')" style="cursor: pointer;">
                <div class="lecture-icon-box" style="background: rgba(var(--accent-blue-rgb), 0.2); color: var(--accent-blue);">
                    <i data-feather="align-left"></i>
                </div>
                <div class="lecture-info">
                    <div class="lecture-title">${l.title}</div>
                    <div class="lecture-desc">Составьте предложение</div>
                </div>
                <i data-feather="chevron-right" class="lecture-arrow"></i>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="repo-header quiz-header">
                <button class="back-btn" onclick="SentenceBuilder.close()">
                    <i data-feather="arrow-left"></i>
                </button>
                <h2>Конструктор</h2>
            </div>
            <div class="lecture-list" style="padding: 20px 0;">
                ${levelListHTML}
            </div>
        `;
        feather.replace();
    },

    close() {
        this.state.scrambledPoolIds = null;
        this.state.userAnswer = [];
        document.getElementById('task-player').classList.remove('visible');
        document.getElementById('task-player').classList.add('hidden');
        switchTab('tasks');
    },

    loadLevel(filename, title) {
        this.state.currentLevelTitle = title;

        // Initialize cache if needed
        if (!this.dataCache) this.dataCache = {};

        // Check cache first
        if (this.dataCache[filename]) {
            console.log(`Using cached data for ${filename}`);
            this.startGame(this.dataCache[filename]);
            return;
        }

        // Show loading
        document.getElementById('task-player').innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height:100vh;">
                <div class="loader-spinner"></div>
            </div>
        `;

        // Define global loader wrapper to intercept data
        const originalLoad = window.loadSentenceData;
        window.loadSentenceData = (levelTitle, data) => {
            // Save to cache
            this.dataCache[filename] = data;
            // Start game
            this.startGame(data);
        };

        // Remove existing script if any
        const existingScript = document.getElementById('sb-level-script');
        if (existingScript) {
            existingScript.remove();
        }

        const script = document.createElement('script');
        script.id = 'sb-level-script';
        script.src = `question/sentence_builder/${filename}`; // removed timestamp

        script.onload = () => console.log(`${filename} loaded`);
        script.onerror = () => {
            alert('Ошибка загрузки уровня. Проверьте файлы.');
            SentenceBuilder.init();
        };
        document.body.appendChild(script);
    },

    startGame(data) {
        // Shuffle sentences
        this.state.data = shuffleArray([...data]);
        this.state.currentIndex = 0;
        this.state.score = 0;
        this.state.isCompleted = false;
        this.state.scrambledPoolIds = null; // Important: reset pool
        this.state.userAnswer = []; // Important: reset answers
        this.loadSentence(0);
    },

    loadSentence(index) {
        if (index >= this.state.data.length) {
            this.finishGame();
            return;
        }

        const sentenceObj = this.state.data[index];
        this.state.currentSentence = sentenceObj;

        // Prepare words - trim to avoid empty items if trailing spaces exist
        const rawWords = sentenceObj.de.trim().split(/\s+/);

        this.state.words = rawWords.map((word, idx) => ({
            id: idx,
            text: word,
            location: 'pool' // all start in pool
        }));

        // Shuffle words for the pool visual, but keep their data structure intact
        // We will render by filtering location

        this.renderGame();
    },

    renderGame() {
        const container = document.getElementById('task-player');
        const s = this.state;

        // Get words for answer area (in order of addition? No, user builds order)
        // Actually, we need to track the order in the answer area.
        // Let's modify state: words is just the list of available words.
        // We need an ordered list of IDs for the answer.
        // Quick fix: let's add `answerOrder` to state or just sort by a new `order` property?
        // Better: `words` array contains objects. When moved to answer, we push to a `userAnswer` array of IDs.

        if (!this.state.userAnswer) this.state.userAnswer = [];

        // Pool words: all words NOT in userAnswer, shuffled? 
        // Or just show them. If we shuffle every render, it might be annoying if they move around when I click one back.
        // Let's only shuffle initially.

        // Setup initial shuffle if new sentence
        if (this.state.scrambledPoolIds === undefined || this.state.scrambledPoolIds === null) {
            const ids = this.state.words.map(w => w.id);
            this.state.scrambledPoolIds = shuffleArray(ids);
            this.state.userAnswer = []; // reset answer
        }

        const answerWords = this.state.userAnswer.map(id => this.state.words.find(w => w.id === id));

        // Pool words are those in scrambledPoolIds that are NOT in userAnswer
        const poolWords = this.state.scrambledPoolIds
            .filter(id => !this.state.userAnswer.includes(id))
            .map(id => this.state.words.find(w => w.id === id));

        const progress = ((s.currentIndex) / s.data.length) * 100;

        const answerHTML = answerWords.map(w => `
            <div class="sb-word-chip" onclick="SentenceBuilder.moveWord(${w.id})">
                ${w.text}
            </div>
        `).join('');

        const poolHTML = poolWords.map(w => `
            <div class="sb-word-chip" onclick="SentenceBuilder.moveWord(${w.id})">
                ${w.text}
            </div>
        `).join('');

        container.innerHTML = `
             <div class="repo-header quiz-header" style="margin-bottom: 20px;">
                <button class="back-btn" onclick="SentenceBuilder.close()">
                    <i data-feather="arrow-left"></i>
                </button>
                <div style="text-align:center">
                    <div class="reader-header-title">${s.currentLevelTitle}</div>
                    <div style="font-size:13px; opacity:0.6">${s.currentIndex + 1} / ${s.data.length}</div>
                </div>
                 <div style="width:40px"></div>
            </div>

             <!-- Progress Bar -->
            <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-bottom:10px; overflow:hidden;">
                <div style="width:${progress}%; height:100%; background:var(--accent-blue); transition:width 0.3s;"></div>
            </div>

            <div class="sb-game-container">
                <div class="sb-translation">
                    ${s.currentSentence.ru}
                </div>

                <div class="sb-answer-area" id="sb-answer-box">
                    ${answerWords.length === 0 ? '<span style="opacity:0.3; font-size:14px;">Нажимайте на слова, чтобы собрать предложение</span>' : answerHTML}
                </div>
                
                <div id="sb-grammar-box" class="sb-grammar-hint"></div>

                <div class="sb-word-pool">
                    ${poolHTML}
                </div>

                <div style="text-align: center;">
                    <button class="sb-word-check-btn" onclick="SentenceBuilder.checkAnswer()" ${this.state.userAnswer.length === 0 ? 'disabled' : ''}>
                        Проверить
                    </button>
                </div>
            </div>
        `;
        feather.replace();
    },

    showGrammarHint(text) {
        const box = document.getElementById('sb-grammar-box');
        if (text) {
            box.innerHTML = `<i data-feather="info" style="margin-right:10px; min-width:18px;"></i> ${text}`;
            box.classList.add('sb-rule-box');
            box.classList.add('visible');
            feather.replace();
        }
    },

    hideGrammarHint() {
        const box = document.getElementById('sb-grammar-box');
        box.classList.remove('visible');
        box.innerHTML = '';
    },

    moveWord(id) {
        // Hide hint on interaction
        this.hideGrammarHint();

        // If in answer, move to pool (remove from userAnswer)
        const inAnswerIdx = this.state.userAnswer.indexOf(id);
        if (inAnswerIdx !== -1) {
            this.state.userAnswer.splice(inAnswerIdx, 1);
        } else {
            // Move to answer
            this.state.userAnswer.push(id);
        }
        this.renderGame();
    },

    checkAnswer() {
        const userAnswerString = this.state.userAnswer.map(id => this.state.words.find(w => w.id === id).text).join(' ');
        const target = this.state.currentSentence.de;

        const answerBox = document.getElementById('sb-answer-box');

        if (userAnswerString === target) {
            // Correct
            answerBox.classList.add('correct');
            // Play sound?
            this.state.score++;

            setTimeout(() => {
                this.state.scrambledPoolIds = null; // force reset for next
                this.state.userAnswer = [];
                this.state.currentIndex++;
                this.loadSentence(this.state.currentIndex);
            }, 1000);
        } else {
            // Wrong
            answerBox.classList.add('wrong');

            // Show grammar hint if available
            if (this.state.currentSentence.grammar) {
                this.showGrammarHint(this.state.currentSentence.grammar);
            }

            setTimeout(() => {
                answerBox.classList.remove('wrong');
            }, 500);
        }
    },

    finishGame() {
        const container = document.getElementById('task-player');
        container.innerHTML = `
            <div class="repo-header quiz-header">
                <button class="back-btn" onclick="SentenceBuilder.close()">
                    <i data-feather="arrow-left"></i>
                </button>
                <h2>Результат</h2>
            </div>
            <div class="quiz-result-card">
                <i data-feather="award" style="width:64px; height:64px; color:var(--accent-blue); margin-bottom:16px;"></i>
                <div class="quiz-score">Уровень пройден!</div>
                <p style="opacity:0.8; margin-bottom:24px;">Вы составили ${this.state.score} предложений.</p>
                <button class="quiz-btn primary" onclick="SentenceBuilder.init()">К выбору уровней</button>
            </div>
        `;
        feather.replace();
    }
};

window.loadSentenceData = function (title, data) {
    SentenceBuilder.startGame(data);
};

// --- Vocabulary Quiz Feature ---
const VocabularyQuiz = {
    units: [
        { id: 'lektion0.js', title: 'Lektion 0' },
        { id: 'lektion1.js', title: 'Lektion 1' },
        { id: 'lektion2.js', title: 'Lektion 2' },
        { id: 'lektion3.js', title: 'Lektion 3' },
        { id: 'lektion4.js', title: 'Lektion 4' },
        { id: 'lektion5.js', title: 'Lektion 5' },
        { id: 'lektion6.js', title: 'Lektion 6' },
        { id: 'lektion7.js', title: 'Lektion 7' },
        { id: 'lektion8.js', title: 'Lektion 8' },
        { id: 'lektion9.js', title: 'Lektion 9' },
        { id: 'lektion10.js', title: 'Lektion 10' },
        { id: 'lektion11.js', title: 'Lektion 11' },
        { id: 'lektion12.js', title: 'Lektion 12' }
    ],
    state: {
        isLoading: false,
        wordPool: [],
        selectedUnits: [],
        quizData: [],
        currentIndex: 0,
        score: 0,
        mistakes: []
    },

    init() {
        // Show Unit Selection Screen
        const container = document.getElementById('task-player');
        container.classList.remove('hidden');
        container.classList.add('visible');

        // Render Unit Selection
        const unitListHTML = this.units.map(u => `
            <label class="custom-checkbox-container">
                <input type="checkbox" class="custom-checkbox-input" value="${u.id}">
                <span class="custom-checkbox-checkmark">
                    <i data-feather="check" style="width: 16px; height: 16px;"></i>
                </span>
                <span class="custom-checkbox-label">${u.title}</span>
            </label>
        `).join('');

        container.innerHTML = `
            <div class="repo-header quiz-header">
                <button class="back-btn" onclick="VocabularyQuiz.close()">
                    <i data-feather="arrow-left"></i>
                </button>
                <h2>Проверка слов</h2>
            </div>
            <div style="padding: 0 0 80px 0; text-align: center;">
                <p style="opacity: 0.7; margin-bottom: 20px; text-align: left;">Выберите уроки для теста:</p>
                <div style="margin-bottom: 24px; text-align: left;">
                    ${unitListHTML}
                </div>
                <button class="quiz-btn primary" onclick="VocabularyQuiz.startLoading()" style="margin-top: 12px;">Начать тест</button>
            </div>
        `;
        feather.replace();
    },

    close() {
        document.getElementById('task-player').classList.remove('visible');
        document.getElementById('task-player').classList.add('hidden');
        switchTab('tasks');
    },

    async startLoading() {
        const checkboxes = document.querySelectorAll('#task-player input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedIds.length === 0) {
            alert('Выберите хотя бы один урок!');
            return;
        }

        // Show loading state
        const container = document.getElementById('task-player');
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div style="font-size: 24px; margin-bottom: 16px;">Загрузка слов...</div>
                <div style="opacity: 0.6;">Пожалуйста, подождите</div>
            </div>
        `;

        this.state.isLoading = true;
        this.state.wordPool = [];
        this.state.selectedUnits = selectedIds;
        this.state.currentIndex = 0;
        this.state.score = 0;
        this.state.mistakes = [];

        // Load all scripts sequentially
        for (const filename of selectedIds) {
            await this.loadScript(filename);
        }

        this.state.isLoading = false;
        this.generateQuiz();
    },

    loadScript(filename) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `words/${filename}`;
            script.onload = () => resolve();
            script.onerror = () => resolve(); // Ignore errors, continue
            document.body.appendChild(script);
        });
    },

    // Called by modified window.loadVocabulary
    collectWords(words) {
        if (this.state.isLoading) {
            this.state.wordPool.push(...words);
        }
    },

    generateQuiz() {
        if (this.state.wordPool.length < 4) {
            alert('Слишком мало слов для теста! Выберите больше уроков.');
            this.init();
            return;
        }

        // Shuffle all words
        const shuffled = shuffleArray([...this.state.wordPool]);
        // Take max 20 questions for regular quiz (or all if asked, but let's limit to 20 for UX)
        // User asked for "all or specific amount", let's do 20 random from selection for now to keep it snappy
        const questions = shuffled.map(wordObj => {
            // Generate 3 distractors
            const distractors = this.state.wordPool
                .filter(w => w.word !== wordObj.word)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(w => w.translation);

            const options = shuffleArray([wordObj.translation, ...distractors]);

            return {
                question: wordObj.word,
                correctAnswer: wordObj.translation,
                options: options,
                original: wordObj
            };
        });

        this.state.quizData = questions;
        this.renderQuestion();
    },

    renderQuestion() {
        if (this.state.currentIndex >= this.state.quizData.length) {
            this.showResults();
            return;
        }

        const q = this.state.quizData[this.state.currentIndex];
        const container = document.getElementById('task-player');

        const optionsHTML = q.options.map((opt, idx) => `
            <button class="quiz-option" onclick="VocabularyQuiz.handleAnswer('${opt.replace(/'/g, "\\'")}', this)">
                ${opt}
            </button>
        `).join('');

        const progress = ((this.state.currentIndex) / this.state.quizData.length) * 100;

        container.innerHTML = `
             <div class="reader-header" style="position:static; margin-bottom:10px; justify-content: space-between;">
                 <button class="back-btn" onclick="VocabularyQuiz.init()"> <!-- Back to selection -->
                    <i data-feather="x"></i>
                </button>
                <div class="reader-header-title">Тест</div>
                <div style="font-size:14px; font-weight:600; color:var(--accent-blue)">${this.state.currentIndex + 1}/${this.state.quizData.length}</div>
            </div>

            <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-bottom:12px; overflow:hidden;">
                <div style="width:${progress}%; height:100%; background:var(--accent-blue); transition:width 0.3s;"></div>
            </div>

            <div class="quiz-card" style="text-align: center;">
                <h3 style="font-size: 32px; margin-bottom: 20px;">${q.question}</h3>
                <div class="quiz-options">
                    ${optionsHTML}
                </div>
            </div>
        `;
        feather.replace();
    },

    handleAnswer(selectedOption, btnElement) {
        const q = this.state.quizData[this.state.currentIndex];
        const buttons = document.querySelectorAll('.quiz-option');

        // Disable all buttons
        buttons.forEach(b => b.disabled = true);

        if (selectedOption === q.correctAnswer) {
            btnElement.classList.add('correct');
            this.state.score++;
        } else {
            btnElement.classList.add('wrong');
            // Highlight correct one
            buttons.forEach(b => {
                if (b.textContent.trim() === q.correctAnswer) {
                    b.classList.add('correct');
                }
            });
            this.state.mistakes.push(q);
        }

        setTimeout(() => {
            this.state.currentIndex++;
            this.renderQuestion();
        }, 1500);
    },

    showResults() {
        const container = document.getElementById('task-player');

        const allQuestions = this.state.quizData;
        const mistakes = this.state.mistakes;
        const correct = allQuestions.filter(q => !mistakes.includes(q));

        const percentage = Math.round((this.state.score / allQuestions.length) * 100);

        // Generate Mistakes List
        let mistakesHTML = '';
        if (mistakes.length > 0) {
            mistakesHTML = `
                <div style="margin-top: 24px; text-align: left; width: 100%;">
                    <h3 style="font-size: 18px; margin-bottom: 12px; color: #ef4444; display: flex; align-items: center; gap: 8px;">
                        <i data-feather="x-circle" style="width: 20px;"></i> Ошибки (${mistakes.length})
                    </h3>
                    ${mistakes.map(m => `
                        <div style="
                            padding: 12px; 
                            background: rgba(239, 68, 68, 0.1); 
                            border: 1px solid rgba(239, 68, 68, 0.2);
                            border-radius: 12px; 
                            margin-bottom: 8px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <div style="font-weight: 500;">${m.question}</div>
                            <div style="opacity: 0.8; font-size: 14px;">${m.correctAnswer}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Generate Correct List
        let correctHTML = '';
        if (correct.length > 0) {
            correctHTML = `
                <div style="margin-top: 24px; text-align: left; width: 100%;">
                    <h3 style="font-size: 18px; margin-bottom: 12px; color: #10b981; display: flex; align-items: center; gap: 8px;">
                         <i data-feather="check-circle" style="width: 20px;"></i> Правильно (${correct.length})
                    </h3>
                    ${correct.map(m => `
                        <div style="
                            padding: 12px; 
                            background: rgba(16, 185, 129, 0.1); 
                            border: 1px solid rgba(16, 185, 129, 0.2);
                            border-radius: 12px; 
                            margin-bottom: 8px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <div style="font-weight: 500;">${m.question}</div>
                            <div style="opacity: 0.8; font-size: 14px;">${m.correctAnswer}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Feedback Message
        let message = 'Продолжайте тренироваться!';
        if (percentage >= 100) message = 'Идеально! 🏆';
        else if (percentage >= 80) message = 'Отличный результат!';
        else if (percentage >= 50) message = 'Хорошо, но можно лучше';

        container.innerHTML = `
            <div class="repo-header quiz-header">
                <button class="back-btn" onclick="VocabularyQuiz.close()">
                    <i data-feather="arrow-left"></i>
                </button>
                <h2>Результат</h2>
            </div>
            <div class="quiz-result-card" style="overflow-y: auto; max-height: 85vh; justify-content: flex-start;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div class="quiz-score">${this.state.score} / ${allQuestions.length}</div>
                    <p style="font-size:18px; color:#fff; margin-bottom:8px;">${message}</p>
                </div>
                
                ${mistakesHTML}
                ${correctHTML}
            </div>
        `;
        feather.replace();
    }
};

// --- Rules Quiz Feature ---
const RulesQuiz = {
    tests: [
        { id: 'rule_base_sentence.js', title: 'Основы предложения' },
        { id: 'rule_akkusativ.js', title: 'Akkusativ' },
        { id: 'rule_dativ.js', title: 'Dativ' },
        { id: 'rule_modal_verbs.js', title: 'Глагол Können' },
        { id: 'rule_strong_verbs.js', title: 'Сильные глаголы' },
        { id: 'rule_possessive.js', title: 'Притяжательные артикли' },
        { id: 'rule_plural.js', title: 'Артикли и Plural' },
        { id: 'rule_dativ_prepositions.js', title: 'Предлоги с Dativ' },
        { id: 'rule_reading.js', title: 'Правила чтения' },
        { id: 'rule_special_verbs.js', title: 'Особые глаголы' }
    ],
    state: {
        currentQuizData: [],
        currentIndex: 0,
        score: 0,
        mistakes: [],
        isLoading: false,
        allMode: false,
        loadedFiles: 0,
        totalFilesToLoad: 0
    },

    init() {
        const container = document.getElementById('task-player');
        container.classList.remove('hidden');
        container.classList.add('visible');

        const testListHTML = this.tests.map(t => `
            <div class="lecture-item" onclick="RulesQuiz.startTest('${t.id}')">
                <div class="lecture-icon-box" style="background: rgba(var(--accent-blue-rgb), 0.2); color: var(--accent-blue);">
                    <i data-feather="check-square"></i>
                </div>
                <div class="lecture-info">
                    <div class="lecture-title">${t.title}</div>
                    <div class="lecture-desc">Проверьте знания правил</div>
                </div>
                <i data-feather="chevron-right" class="lecture-arrow"></i>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="repo-header quiz-header">
                <button class="back-btn" onclick="RulesQuiz.close()">
                    <i data-feather="arrow-left"></i>
                </button>
                <h2>Тест по правилам</h2>
            </div>
            <div class="lecture-list" style="padding: 20px 0;">
                <div class="lecture-item" onclick="RulesQuiz.startAll()" style="background: rgba(var(--accent-blue-rgb), 0.1); border: 1px dashed var(--accent-blue);">
                    <div class="lecture-icon-box" style="background: var(--accent-blue); color: white;">
                        <i data-feather="layers"></i>
                    </div>
                    <div class="lecture-info">
                        <div class="lecture-title">Выбрать все правила</div>
                        <div class="lecture-desc">Мега-тест по всем лекциям</div>
                    </div>
                </div>
                ${testListHTML}
            </div>
        `;
        feather.replace();
    },

    close() {
        document.getElementById('task-player').classList.remove('visible');
        document.getElementById('task-player').classList.add('hidden');
        switchTab('tasks');
    },

    startTest(filename) {
        this.state.currentIndex = 0;
        this.state.score = 0;
        this.state.mistakes = [];
        this.state.currentQuizData = [];
        this.state.allMode = false;

        this.loadTestData(filename);
    },

    startAll() {
        this.state.currentIndex = 0;
        this.state.score = 0;
        this.state.mistakes = [];
        this.state.currentQuizData = [];
        this.state.allMode = true;
        this.state.loadedFiles = 0;
        this.state.totalFilesToLoad = this.tests.length;

        this.tests.forEach(t => this.loadTestData(t.id));
    },

    loadTestData(filename) {
        const script = document.createElement('script');
        script.src = `question/rules_test/${filename}?t=${Date.now()}`;
        document.body.appendChild(script);
    },

    setupQuiz(title, data) {
        if (this.state.allMode) {
            this.state.currentQuizData.push(...data);
            this.state.loadedFiles++;
            if (this.state.loadedFiles === this.state.totalFilesToLoad) {
                this.state.currentQuizData = shuffleArray(this.state.currentQuizData);
                this.renderQuestion();
            }
        } else {
            this.state.currentQuizData = shuffleArray(data);
            this.renderQuestion();
        }
    },

    renderQuestion() {
        const container = document.getElementById('task-player');
        const q = this.state.currentQuizData[this.state.currentIndex];
        const progress = (this.state.currentIndex / this.state.currentQuizData.length) * 100;

        container.innerHTML = `
            <div class="repo-header quiz-header" style="margin-bottom: 20px;">
                <button class="back-btn" onclick="RulesQuiz.init()">
                    <i data-feather="arrow-left"></i>
                </button>
                <div style="text-align:center">
                    <div class="reader-header-title">Тест по правилам</div>
                    <div style="font-size:13px; opacity:0.6">${this.state.currentIndex + 1} / ${this.state.currentQuizData.length}</div>
                </div>
                <div style="width:40px"></div>
            </div>

            <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-bottom:30px;">
                <div style="width:${progress}%; height:100%; background:var(--accent-blue); transition:width 0.3s;"></div>
            </div>

            <div class="sb-game-container">
                <div class="sb-translation" style="font-size: 22px; margin-bottom: 40px; min-height:80px;">
                    ${q.question}
                </div>

                <div class="quiz-options">
                    ${q.options.map((opt, idx) => `
                        <button class="quiz-option-btn" onclick="RulesQuiz.checkAnswer(${idx})">
                            ${opt}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    checkAnswer(idx) {
        const q = this.state.currentQuizData[this.state.currentIndex];
        const buttons = document.querySelectorAll('.quiz-option-btn');

        if (idx === q.correct) {
            buttons[idx].classList.add('correct');
            this.state.score++;
        } else {
            buttons[idx].classList.add('wrong');
            buttons[q.correct].classList.add('correct');
            this.state.mistakes.push({
                question: q.question,
                userAnswer: q.options[idx],
                correctAnswer: q.options[q.correct]
            });
        }

        buttons.forEach(btn => btn.disabled = true);

        setTimeout(() => {
            this.state.currentIndex++;
            if (this.state.currentIndex < this.state.currentQuizData.length) {
                this.renderQuestion();
            } else {
                this.showResults();
            }
        }, 1500);
    },

    showResults() {
        const container = document.getElementById('task-player');
        const percentage = Math.round((this.state.score / this.state.currentQuizData.length) * 100);

        let mistakesHTML = '';
        if (this.state.mistakes.length > 0) {
            mistakesHTML = `
                <div style="margin-top: 24px; text-align: left; width: 100%;">
                    <h3 style="font-size: 18px; margin-bottom: 12px; color: #ef4444;">Работа над ошибками:</h3>
                    ${this.state.mistakes.map(m => `
                        <div style="padding:12px; background:rgba(239, 68, 68, 0.1); border-radius:12px; margin-bottom:8px; border:1px solid rgba(239, 68, 68, 0.2)">
                            <div style="font-weight:600; margin-bottom:4px;">${m.question}</div>
                            <div style="font-size:14px; opacity:0.8">Ваш ответ: <span style="text-decoration:line-through">${m.userAnswer}</span></div>
                            <div style="font-size:14px; color:#10b981">Верно: ${m.correctAnswer}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="repo-header quiz-header">
                <button class="back-btn" onclick="RulesQuiz.init()">
                    <i data-feather="arrow-left"></i>
                </button>
                <h2>Результат</h2>
            </div>
            <div class="quiz-result-card" style="overflow-y: auto; max-height: 80vh; justify-content: flex-start; padding: 30px 20px;">
                <div style="text-align: center;">
                    <div class="quiz-score" style="font-size: 48px;">${this.state.score} / ${this.state.currentQuizData.length}</div>
                    <div style="font-size: 18px; margin-top: 10px; opacity: 0.8;">Правильных ответов (${percentage}%)</div>
                </div>
                ${mistakesHTML}
                <button class="quiz-btn primary" onclick="RulesQuiz.init()" style="margin-top:30px; width:100%">К выбору тем</button>
            </div>
        `;
        feather.replace();
    }
};

window.loadRulesQuizData = function (title, data) {
    RulesQuiz.setupQuiz(title, data);
};

// ... existing code ...
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});
