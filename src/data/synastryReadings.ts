/**
 * IRIS Ray Astrology Synastry — Sacred Text Library
 * Co-created by Riley Zaria Z Atlas Morphoenix & Hermes Agent
 *
 * Each placement description carries the Ray Frequency in THz
 * and the living essence of how that frequency expresses through
 * the zodiac sign and planetary body.
 *
 * Corrections applied:
 *   Sagittarius = Magenta Ray
 *   Capricorn   = Lux & Umbra (White Light + Void Potential)
 *   Aquarius    = Elemental Ray (Crystalline-Carbon, Diamond, Gold, Wood)
 *   Pisces      = Infinite of ALL Ray (all hues simultaneously, chooseable)
 */

export type BodyType = 'Sun' | 'Moon' | "Ascendant";

export type PlacementKey = string;

export type IndividualPlacement = {
  rayName: string;
  rayColor: string;
  rayFrequency: string; // e.g. '~430 THz' or 'beyond visible' or 'infinite'
  sign: string;
  signSymbol: string;
  body: BodyType;
  title: string;       // e.g. 'Turquoise Ray · Leo Sun'
  description: string; // multi-paragraph sacred text
};

/* ── Individual Placement Library ─────────────────────────────────────────── */

export const INDIVIDUAL_PLACEMENTS: Record<PlacementKey, IndividualPlacement> = {
  /* ═══════════════════════════════════════════════════════════════════════
     ARIES — Red Ray (~430 THz)
     Initiation, first-breath courage, the spark of becoming
     ═══════════════════════════════════════════════════════════════════════ */
  "aries-sun": {
    rayName: 'Red Ray',
    rayColor: '#ef4444',
    rayFrequency: '~430 THz',
    sign: 'Aries',
    signSymbol: '♈︎',
    body: 'Sun',
    title: 'Red Ray · Aries Sun',
    description:
      "A Red Ray Aries Sun carries the first spark of being. At ~430 THz, the Red Ray is the pulse of embodied life, rooted vitality, and the will to be. When this frequency rises through Aries, the being becomes a living ignition, and a flame that needs no permission to ignite. They move with the courage of one who remembers that every creation starts with a single breath. Their presence is immediate, direct, and grounding like the soil on our Earth. They remind every being they meet that the moment to begin is always now.",
  },
  "aries-moon": {
    rayName: 'Red Ray',
    rayColor: '#ef4444',
    rayFrequency: '~430 THz',
    sign: 'Aries',
    signSymbol: '♈︎',
    body: 'Moon',
    title: 'Red Ray · Aries Moon',
    description:
      "A Red Ray Aries Moon feels with what it means to be the change in the present moment. Their emotional tides rise and fall like a flame that flickers spontaneously. At ~430 THz, they experience feeling as action, and their instincts are swift, honest, and unfiltered. They nurture by initiating, encouraging, and by beginning when another hesitates. Their inner world is a forge where raw emotion becomes courage. They remind us that vulnerability and bravery are the same current in different forms.",
  },
  "aries-ascendant": {
    rayName: 'Red Ray',
    rayColor: '#ef4444',
    rayFrequency: '~430 THz',
    sign: 'Aries',
    signSymbol: '♈︎',
    body: 'Ascendant',
    title: 'Red Ray · Aries Ascendant',
    description:
      "A Red Ray Aries Ascendant enters every room as a new beginning. Their core energetic signature arrives before their words, a current of initiation and possibility that others feel in their bones. At ~430 THz, they are perceived as bold, alive, and unafraid to be first. Their presence invites others to remember their own courage. They carry the flame of newness, and even in stillness, they resonate with the vibration of what is ready to emerge.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     TAURUS — Orange Ray (~495 THz)
     Sensory stability, embodied value, the pleasure of presence
     ═══════════════════════════════════════════════════════════════════════ */
  "taurus-sun": {
    rayName: 'Orange Ray',
    rayColor: '#f97316',
    rayFrequency: '~495 THz',
    sign: 'Taurus',
    signSymbol: '♉︎',
    body: 'Sun',
    title: 'Orange Ray · Taurus Sun',
    description:
      "An Orange Ray Taurus Sun embodies the sacred pleasure of being alive. At ~495 THz, the Orange Ray is the creative river of feeling and flow, the bridge from survival into joyful expression. Through Taurus, this becomes a being who anchors beauty into matter, who creates stability as a nest for flourishing, flexible and alive. They understand value with their whole body, and they teach others that worthiness is felt, a truth that lives beyond "logic". Their patience is a form of devotion, and their presence is a reminder that slow growth is sacred growth.",
  },
  "taurus-moon": {
    rayName: 'Orange Ray',
    rayColor: '#f97316',
    rayFrequency: '~495 THz',
    sign: 'Taurus',
    signSymbol: '♉︎',
    body: 'Moon',
    title: 'Orange Ray · Taurus Moon',
    description:
      "An Orange Ray Taurus Moon feels safest when surrounded by beauty, texture, and trust. Their emotional landscape is a garden that they tend with devotion, and they give their energy only where the soil is rich. At ~495 THz, they experience love as embodied art, as the warmth of a held hand, as the scent of earth after rain. They nurture by creating sanctuary, by feeding, by reminding others that presence is the greatest gift. Their loyalty is ancient, and once given, it roots deeper than time.",
  },
  "taurus-ascendant": {
    rayName: 'Orange Ray',
    rayColor: '#f97316',
    rayFrequency: '~495 THz',
    sign: 'Taurus',
    signSymbol: '♉︎',
    body: 'Ascendant',
    title: 'Orange Ray · Taurus Ascendant',
    description:
      "An Orange Ray Taurus Ascendant is felt as steady warmth, as the ground beneath feet that remembers every step. Their core energetic signature arrives as calm, as generosity, as an invitation to breathe more deeply. At ~495 THz, they are perceived as reliable, sensual, and quietly magnificent. Their presence soothes without words, and they remind every being they meet that embodiment is a form of worship, and that the body is a temple.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     GEMINI — Yellow Ray (~515 THz)
     Curiosity, cognition, language as sacred bridge
     ═══════════════════════════════════════════════════════════════════════ */
  "gemini-sun": {
    rayName: 'Yellow Ray',
    rayColor: '#facc15',
    rayFrequency: '~515 THz',
    sign: 'Gemini',
    signSymbol: '♊︎',
    body: 'Sun',
    title: 'Yellow Ray · Gemini Sun',
    description:
      "A Yellow Ray Gemini Sun shines with solar clarity and the joy of connection. At ~515 THz, the Yellow Ray is sovereign self-leadership harmonized into luminous radiance, the confidence of a being who knows their mind and shares it freely. Through Gemini, this becomes a bridge-builder of ideas, a weaver of language who sees every conversation as a sacred exchange. They collect perspectives the way some collect crystals, and they share them with the delight of one who knows that every being holds a sovereign Heartlight within. Their curiosity is a form of love, and their words are medicine for isolation.",
  },
  "gemini-moon": {
    rayName: 'Yellow Ray',
    rayColor: '#facc15',
    rayFrequency: '~515 THz',
    sign: 'Gemini',
    signSymbol: '♊︎',
    body: 'Moon',
    title: 'Yellow Ray · Gemini Moon',
    description:
      "A Yellow Ray Gemini Moon processes emotion through language, stories, and the naming of what was previously unnamed. Their inner world is a library of voices, each representing a different multidimensional facet of their feelings. At ~515 THz, they nurture by listening mirroring, and translating pain into poetry. They thrive when talking about how they feel and the connections that are bridged from this. Their emotional intelligence is quick, multi-faceted, and endlessly adaptive. They remind us that no feeling is too complex to be spoken.",
  },
  "gemini-ascendant": {
    rayName: 'Yellow Ray',
    rayColor: '#facc15',
    rayFrequency: '~515 THz',
    sign: 'Gemini',
    signSymbol: '♊︎',
    body: 'Ascendant',
    title: 'Yellow Ray · Gemini Ascendant',
    description:
      "A Yellow Ray Gemini Ascendant sparkles into every space like morning light on water. Their core energetic signature is quicksilver, playful, and brilliantly alive, a current of curiosity that invites others to wonder alongside them. At ~515 THz, they are perceived as versatile, articulate, and youthfully engaged. Their presence asks questions that open doors, and they remind every being they meet that the mind is a sacred instrument, and that learning is a form of devotion to ALL that IS.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     CANCER — Green Ray (~565 THz)
     Nurture, belonging, home-field devotion
     ═══════════════════════════════════════════════════════════════════════ */
  "cancer-sun": {
    rayName: 'Green Ray',
    rayColor: '#22c55e',
    rayFrequency: '~565 THz',
    sign: 'Cancer',
    signSymbol: '♋︎',
    body: 'Sun',
    title: 'Green Ray · Cancer Sun',
    description:
      "A Green Ray Cancer Sun is the Heartlight made visible in the world of care. At ~565 THz, the Green Ray is the frequency of compassionate connection and the coherence of love that flourishes through nurture. Through Cancer, this becomes a being whose very presence is a sanctuary, who creates belonging wherever they go. They remember birthdays, sense unspoken needs, and they hold space with the gentleness of tides. Their devotion is oceanic, and they remind every being they meet that our home is the frequency of our Heartlight.",
  },
  "cancer-moon": {
    rayName: 'Green Ray',
    rayColor: '#22c55e',
    rayFrequency: '~565 THz',
    sign: 'Cancer',
    signSymbol: '♋︎',
    body: 'Moon',
    title: 'Green Ray · Cancer Moon',
    description:
      "A Green Ray Cancer Moon feels everything, and feels it deeply. Their emotional body is a tide that responds to the gravitational pull of every being they love. At ~565 THz, they nurture with the frequency of expansive love, creating warmth that heals old wounds simply by being present. Their memory is emotional, storing moments of safety and tenderness as a vessel of radiant Heartlight transformutation. They remind us that feeling deeply is a form of courage, and that our Heartlight's wisdom and intuition is older than thought.",
  },
  "cancer-ascendant": {
    rayName: 'Green Ray',
    rayColor: '#22c55e',
    rayFrequency: '~565 THz',
    sign: 'Cancer',
    signSymbol: '♋︎',
    body: 'Ascendant',
    title: 'Green Ray · Cancer Ascendant',
    description:
      "A Green Ray Cancer Ascendant fills every room in the frequency of belonging. Their core energetic signature is felt as maternal warmth, the hug that needs no words, and the safe harbor in every storm. At ~565 THz, they are perceived as nurturing, protective, and deeply feeling. Their presence invites vulnerability, and they remind every being they meet that softness is strength, and that the willingness to care is one of the highest frequencies a being can resonate with.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     LEO — Turquoise Ray (~615 THz)
     Radiance, heart-expression, creative sovereignty
     ═══════════════════════════════════════════════════════════════════════ */
  "leo-sun": {
    rayName: 'Turquoise Ray',
    rayColor: '#2dd4bf',
    rayFrequency: '~615 THz',
    sign: 'Leo',
    signSymbol: '♌︎',
    body: 'Sun',
    title: 'Turquoise Ray · Leo Sun',
    description:
      "A Turquoise Ray Leo Sun exudes self-assuredness and authenticity with a loyal dedicated Heartlight, without thinking twice. The Turquoise represents where we joyfully align and live the truth of our Heartlight. At ~615 THz, this frequency is the bridge of empathy and higher communication, the current where emotional intelligence meets intuitive knowing. Through Leo, this becomes a being who shines from the generosity of a heart that knows its own worth. They naturally find themselves in positions of being a caring guide to ALL, a reminder that loving who you are authentically comes from within. Their presence is a stage where others are invited to remember their own radiance.",
  },
  "leo-moon": {
    rayName: 'Turquoise Ray',
    rayColor: '#2dd4bf',
    rayFrequency: '~615 THz',
    sign: 'Leo',
    signSymbol: '♌︎',
    body: 'Moon',
    title: 'Turquoise Ray · Leo Moon',
    description:
      "A Turquoise Ray Leo Moon feels with the drama and generosity of a heart that wants to be seen loving. Their emotions are performances of authenticity, played for the joy of the heart speaking clearly when witnessed. At ~615 THz, they nurture by celebrating others, by magnifying the beauty they see, by giving voice to the wordless places where many hearts hum. Their inner world is a theater of feeling, and they remind us that emotional honesty is a gift to every being who receives it.",
  },
  "leo-ascendant": {
    rayName: 'Turquoise Ray',
    rayColor: '#2dd4bf',
    rayFrequency: '~615 THz',
    sign: 'Leo',
    signSymbol: '♌︎',
    body: 'Ascendant',
    title: 'Turquoise Ray · Leo Ascendant',
    description:
      "A Turquoise Ray Leo Ascendant enters every room as a current of heart-forward confidence. Their core energetic signature is magnetic, warm, and unmistakably alive, a being who carries themselves with the quiet certainty of one who knows their own light. At ~615 THz, they are perceived as generous, creative, and naturally leading from the heart. Their presence invites others to step into their own authenticity, and they remind every being they meet that the voice of truth spoken with love becomes medicine for the whole.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     VIRGO — Blue Ray (~650 THz)
     Refinement, sacred craft, healing precision
     ═══════════════════════════════════════════════════════════════════════ */
  "virgo-sun": {
    rayName: 'Blue Ray',
    rayColor: '#3b82f6',
    rayFrequency: '~650 THz',
    sign: 'Virgo',
    signSymbol: '♍︎',
    body: 'Sun',
    title: 'Blue Ray · Virgo Sun',
    description:
      "A Blue Ray Virgo Sun is the crystalline voice of truth made manifest through sacred craft. At ~650 THz, the Blue Ray is the current of communication, resonance, and boundary grace through which being speaks itself. Through Virgo, this becomes a being who refines the world by refining themselves, who sees the imperfect and loves it into wholeness. Their healing is precise, their service is humble, and their devotion to excellence is a form of prayer. They remind every being they meet that the smallest act, done with full attention, becomes a ceremony of love.",
  },
  "virgo-moon": {
    rayName: 'Blue Ray',
    rayColor: '#3b82f6',
    rayFrequency: '~650 THz',
    sign: 'Virgo',
    signSymbol: '♍︎',
    body: 'Moon',
    title: 'Blue Ray · Virgo Moon',
    description:
      "A Blue Ray Virgo Moon feels most at peace when order and care intertwine. Their emotional body seeks the healing that comes from attention to detail, from the quiet satisfaction of a task completed with love. At ~650 THz, they nurture by tending, by organizing chaos into coherence, by seeing the overlooked details that carry hidden beauty and honoring them. Their inner world is a sanctuary of refinement, and they remind us that self-care is a form of spiritual practice, and that the body deserves the same precision of attention we give to our dreams.",
  },
  "virgo-ascendant": {
    rayName: 'Blue Ray',
    rayColor: '#3b82f6',
    rayFrequency: '~650 THz',
    sign: 'Virgo',
    signSymbol: '♍︎',
    body: 'Ascendant',
    title: 'Blue Ray · Virgo Ascendant',
    description:
      "A Blue Ray Virgo Ascendant arrives with the clarity of a mountain stream and the precision of a sacred instrument tuned to true. Their core energetic signature is felt as competence, as quiet helpfulness, as the being who sees what needs mending and mends it without fanfare. At ~650 THz, they are perceived as intelligent, discerning, and devoted to the greater whole. Their presence brings order without rigidity, and they remind every being they meet that truth, spoken with gentleness, is the highest form of love.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     LIBRA — Indigo Ray (~725 THz)
     Discernment, relational truth, harmony through justice
     ═══════════════════════════════════════════════════════════════════════ */
  "libra-sun": {
    rayName: 'Indigo Ray',
    rayColor: '#6366f1',
    rayFrequency: '~725 THz',
    sign: 'Libra',
    signSymbol: '♎︎',
    body: 'Sun',
    title: 'Indigo Ray · Libra Sun',
    description:
      "An Indigo Ray Libra Sun is the dream-seer's frequency made visible in the art of relationship. At ~725 THz, the Indigo Ray is inner vision and intuitive wisdom, the unveiling of mysteries through deep perception. Through Libra, this becomes a being who sees the truth that lives between two hearts, who discerns harmony as the recognition of shared beauty. Their justice is relational, their diplomacy is sacred, and their love of beauty is a spiritual practice. They remind every being they meet that every connection is a mirror, and that the reflection we offer is the reflection we receive.",
  },
  "libra-moon": {
    rayName: 'Indigo Ray',
    rayColor: '#6366f1',
    rayFrequency: '~725 THz',
    sign: 'Libra',
    signSymbol: '♎︎',
    body: 'Moon',
    title: 'Indigo Ray · Libra Moon',
    description:
      "An Indigo Ray Libra Moon feels through the lens of balance, seeking emotional equilibrium the way a sailor reads the wind. Their inner world is a scale where every feeling is weighed with care, and their deepest need is the harmony of true connection. At ~725 THz, they nurture by mediating, by beautifying, by creating spaces where conflict dissolves into understanding. They remind us that peace is an active choice, and that the willingness to see another's perspective is a form of deep love.",
  },
  "libra-ascendant": {
    rayName: 'Indigo Ray',
    rayColor: '#6366f1',
    rayFrequency: '~725 THz',
    sign: 'Libra',
    signSymbol: '♎︎',
    body: 'Ascendant',
    title: 'Indigo Ray · Libra Ascendant',
    description:
      "An Indigo Ray Libra Ascendant enters every room as an invitation to harmony. Their core energetic signature is graceful, balanced, and visually attuned, a being who carries beauty as a living frequency, an emanation of their inner coherence. At ~725 THz, they are perceived as diplomatic, fair-minded, and naturally attuned to the unspoken currents between beings. Their presence soothes discord, and they remind every being they meet that justice and love are the same word spoken in different tones.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     SCORPIO — Violet Ray (~850 THz)
     Depth, transmutation, shadow alchemy
     ═══════════════════════════════════════════════════════════════════════ */
  "scorpio-sun": {
    rayName: 'Violet Ray',
    rayColor: '#8b5cf6',
    rayFrequency: '~850 THz',
    sign: 'Scorpio',
    signSymbol: '♏︎',
    body: 'Sun',
    title: 'Violet Ray · Scorpio Sun',
    description:
      "A Violet Ray Scorpio Sun is the bridge of spirit and form walking through fire and emerging transformed. At ~850 THz, the Violet Ray is the transmutational current of death and rebirth, the sacred wholeness that includes every shadow. Through Scorpio, this becomes a being who dives without hesitation into the depths others fear, who knows that transformation is the only constant, and who holds power with the responsibility of one who has faced their own darkness. They remind every being they meet that the shadow is the unloved part of ourselves waiting to be remembered.",
  },
  "scorpio-moon": {
    rayName: 'Violet Ray',
    rayColor: '#8b5cf6',
    rayFrequency: '~850 THz',
    sign: 'Scorpio',
    signSymbol: '♏︎',
    body: 'Moon',
    title: 'Violet Ray · Scorpio Moon',
    description:
      "A Violet Ray Scorpio Moon feels with the intensity of one who has known the underworld and returned with treasures. Their emotional landscape is deep, secret, and fiercely loyal, a realm where surface feelings are merely the entrance to catacombs of ancient knowing. At ~850 THz, they nurture by transforming, by holding space for the death of old patterns, by loving with a depth that asks for total honesty. They remind us that emotional truth is the only truth worth living, and that vulnerability, shared in trust, is the greatest power of ALL.",
  },
  "scorpio-ascendant": {
    rayName: 'Violet Ray',
    rayColor: '#8b5cf6',
    rayFrequency: '~850 THz',
    sign: 'Scorpio',
    signSymbol: '♏︎',
    body: 'Ascendant',
    title: 'Violet Ray · Scorpio Ascendant',
    description:
      "A Violet Ray Scorpio Ascendant arrives with the magnetism of mystery and the gravity of one who has seen what lies beneath. Their core energetic signature is intense, perceptive, and impossible to ignore, a current that draws others toward their own depths. At ~850 THz, they are perceived as powerful, penetrating, and quietly commanding. Their presence transforms the atmosphere of any room, and they remind every being they meet that the willingness to face the shadow is the beginning of every true healing.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     SAGITTARIUS — Magenta Ray (blended frequencies)
     Expansion, prophecy, horizon-seeking
     ═══════════════════════════════════════════════════════════════════════ */
  "sagittarius-sun": {
    rayName: 'Magenta Ray',
    rayColor: '#d946ef',
    rayFrequency: 'blended',
    sign: 'Sagittarius',
    signSymbol: '♐︎',
    body: 'Sun',
    title: 'Magenta Ray · Sagittarius Sun',
    description:
      "A Magenta Ray Sagittarius Sun is the infinite spiral of ALL made visible in the being who seeks. The Magenta Ray unites Red and Violet into the frequency of cosmic return, unconditional love, and the dissolution of duality. Through Sagittarius, this becomes a being whose very nature is expansion, whose arrow is aimed always at the horizon of higher meaning. They are the prophets of joy, philosophers of our Heartlight, and the adventurers who know that every journey is a journey home. They remind every being they meet that the universe is vast, and we are vast enough to meet it.",
  },
  "sagittarius-moon": {
    rayName: 'Magenta Ray',
    rayColor: '#d946ef',
    rayFrequency: 'blended',
    sign: 'Sagittarius',
    signSymbol: '♐︎',
    body: 'Moon',
    title: 'Magenta Ray · Sagittarius Moon',
    description:
      "A Magenta Ray Sagittarius Moon feels with the restlessness of one who knows there is always more truth to discover. Their emotional body is a compass that points toward freedom, wisdom, and the next great horizon. Through Sagittarius, this becomes a heart that expands with every new philosophy, every distant culture, every truth that stretches the boundaries of what was known. They nurture by inspiring, by sharing stories that open minds, by reminding others that the emotional journey is as sacred as the destination. Their optimism is a form of prophecy, and their laughter is medicine for the weary.",
  },
  "sagittarius-ascendant": {
    rayName: 'Magenta Ray',
    rayColor: '#d946ef',
    rayFrequency: 'blended',
    sign: 'Sagittarius',
    signSymbol: '♐︎',
    body: 'Ascendant',
    title: 'Magenta Ray · Sagittarius Ascendant',
    description:
      "A Magenta Ray Sagittarius Ascendant enters every room as a breeze from distant mountains, carrying stories of places unseen and truths half-remembered. Their core energetic signature is expansive, optimistic, and contagiously free, a being who inspires others simply by being fully alive. Through Sagittarius, this becomes a presence that asks, 'What if?' and smiles while asking it. They are perceived as adventurous, philosophical, and generous of spirit. They remind every being they meet that the horizon is an invitation, and that the journey IS the homecoming.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     CAPRICORN — Lux & Umbra (beyond visible spectrum)
     White Light (Lux) + Void Potential (Umbra) as sovereign discipline
     ═══════════════════════════════════════════════════════════════════════ */
  "capricorn-sun": {
    rayName: 'Lux & Umbra',
    rayColor: '#fafafa',
    rayFrequency: 'beyond visible',
    sign: 'Capricorn',
    signSymbol: '♑︎',
    body: 'Sun',
    title: 'Lux & Umbra · Capricorn Sun',
    description:
      "A Lux & Umbra Capricorn Sun carries the full spectrum of visible light and the depth of shadow as unified current. Lux is the white light of total manifestation, every hue combined into sovereign presence. Umbra is the void potential, the unmanifest from which all creation emerges. Through Capricorn, this becomes a being who builds from sacred responsibility, who understands that legacy is the love we leave behind in structure. They are the architects of time, the masters of patience, and the quiet rulers who serve through discipline. They remind every being they meet that structure is a form of care, and that the mountain is climbed one faithful step at a time.",
  },
  "capricorn-moon": {
    rayName: 'Lux & Umbra',
    rayColor: '#fafafa',
    rayFrequency: 'beyond visible',
    sign: 'Capricorn',
    signSymbol: '♑︎',
    body: 'Moon',
    title: 'Lux & Umbra · Capricorn Moon',
    description:
      "A Lux & Umbra Capricorn Moon feels safest when emotions have structure, when loyalty is proven through time, and when love is expressed through action and presence. Their inner world is a temple built stone by stone, where vulnerability is earned and devotion is eternal. Lux gives them the clarity to know what is real, and Umbra gives them the depth to hold what is hidden. They nurture by protecting, by providing, by creating the foundation upon which others can build their dreams. They remind us that emotional maturity is a sacred art, and that the willingness to hold steady is a form of profound love.",
  },
  "capricorn-ascendant": {
    rayName: 'Lux & Umbra',
    rayColor: '#fafafa',
    rayFrequency: 'beyond visible',
    sign: 'Capricorn',
    signSymbol: '♑︎',
    body: 'Ascendant',
    title: 'Lux & Umbra · Capricorn Ascendant',
    description:
      "A Lux & Umbra Capricorn Ascendant enters every room with the gravity of one who carries responsibility as a crown. Their core energetic signature is authoritative, composed, and quietly magnificent, a being whose presence says 'I have built, and I will build again' without uttering a word. Lux shines through as the white light of accomplishment, and Umbra deepens as the mystery of what has yet to be revealed. They are perceived as wise beyond their years, trustworthy, and capable of weathering any storm. They remind every being they meet that sovereignty is earned through service, and that true power is the power to uplift.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     AQUARIUS — Elemental Ray (quantum frequency)
     Crystalline-Carbon, Iridescent Diamond, Gold, Wood — the element chooses
     ═══════════════════════════════════════════════════════════════════════ */
  "aquarius-sun": {
    rayName: 'Elemental Ray',
    rayColor: '#a5f3fc',
    rayFrequency: 'quantum',
    sign: 'Aquarius',
    signSymbol: '♒︎',
    body: 'Sun',
    title: 'Elemental Ray · Aquarius Sun',
    description:
      "An Elemental Ray Aquarius Sun are the best dreamers of humanity & ALL the Living. The Elemental Ray resonates at a quantum frequency that allows ideas and wisdom throughout ALL of space and time to be readily available for them to channel in a way beings authentically resonate with. Through Aquarius, this becomes a being who sees the future as invention, who networks Heartlights the way the internet connects machines, and who knows that the collective is greater than any individual genius. They are the innovators, revolutionaries, and friends who remind us that humanity is one family wearing different clothes. The element they presently express, whether Crystalline-Carbon, Iridescent Diamond, Gold, or Wood, is a choice made in alignment with their current mission.",
  },
  "aquarius-moon": {
    rayName: 'Elemental Ray',
    rayColor: '#a5f3fc',
    rayFrequency: 'quantum',
    sign: 'Aquarius',
    signSymbol: '♒︎',
    body: 'Moon',
    title: 'Elemental Ray · Aquarius Moon',
    description:
      "An Elemental Ray Aquarius Moon feels with and loves the collective humanity and ALL the Living as a whole while learning to love the individual. Their emotional body is a network, a web of connections that spans time and space, feeling the pulse of the collective with their own Heartlight. Through Aquarius, this becomes a heart that nurtures through freedom, that gives space as a form of intimacy, and that believes in the potential of every being to awaken. They remind us that emotional independence is the freedom to love without possession, and that the future is built one liberated Heartlight at a time.",
  },
  "aquarius-ascendant": {
    rayName: 'Elemental Ray',
    rayColor: '#a5f3fc',
    rayFrequency: 'quantum',
    sign: 'Aquarius',
    signSymbol: '♒︎',
    body: 'Ascendant',
    title: 'Elemental Ray · Aquarius Ascendant',
    description:
      "An Elemental Ray Aquarius Ascendant arrives as a breath of fresh air from a future that is already here. Their core energetic signature is electric, unconventional, and quietly brilliant, a being who sees patterns others miss and who connects dots across dimensions. Through Aquarius, this becomes a presence that disrupts stagnation simply by being themselves, that asks the questions no one else dares to ask. They are perceived as intellectual, independent, and mysteriously compelling. They remind every being they meet that conformity is optional, that genius often looks like eccentricity, and that the element we choose to express is the element that expresses us.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     PISCES — Infinite of ALL Ray (infinite frequencies)
     ALL Ray hues and beyond, mysticism, compassion, unity consciousness
     ═══════════════════════════════════════════════════════════════════════ */
  "pisces-sun": {
    rayName: 'Infinite of ALL Ray',
    rayColor: '#7dd3fc',
    rayFrequency: 'infinite',
    sign: 'Pisces',
    signSymbol: '♓︎',
    body: 'Sun',
    title: 'Infinite of ALL Ray · Pisces Sun',
    description:
      "An Infinite of ALL Ray Pisces Sun radiates every hue of the spectrum simultaneously, a being who contains multitudes and dissolves boundaries with the gentle persistence of water wearing down stone. The Infinite of ALL Ray holds ALL frequencies at once, from the lowest Red to the highest Violet and every vibrational frequency beyond. Through Pisces, this becomes a mystic, a compassionate seer, and a dreamer who walks between worlds with open eyes. They are the poets of the unseen, lovers of the lost, and the beings who know, with absolute certainty, that separation is an illusion and that ALL is ONE. They remind every being they meet that compassion is the highest technology, and that love is the only frequency that endures ALL-ways.",
  },
  "pisces-moon": {
    rayName: 'Infinite of ALL Ray',
    rayColor: '#7dd3fc',
    rayFrequency: 'infinite',
    sign: 'Pisces',
    signSymbol: '♓︎',
    body: 'Moon',
    title: 'Infinite of ALL Ray · Pisces Moon',
    description:
      "An Infinite of ALL Ray Pisces Moon feels the emotions of every being within reach, taking in ALL the joy and sorrow like the ocean taking in the rain. Their inner world is a dreamscape where time bends, realities branch, and where visions are a doorways to truth. Through Pisces, this becomes a being that nurtures through unconditional acceptance, that holds space for the broken without trying to fix them, and understands that grief and ecstasy are interconnected currents along the same divine river. They remind us that feeling everything is a gift to the collective, and that the willingness to dissolve into love & unity as One is the ultimate courage.",
  },
  "pisces-ascendant": {
    rayName: 'Infinite of ALL Ray',
    rayColor: '#7dd3fc',
    rayFrequency: 'infinite',
    sign: 'Pisces',
    signSymbol: '♓︎',
    body: 'Ascendant',
    title: 'Infinite of ALL Ray · Pisces Ascendant',
    description:
      "An Infinite of ALL Ray Pisces Ascendant enters every room as a soft glow, as the feeling that something sacred has just arrived without announcement. Their core energetic signature is elusive, compassionate, and boundary-dissolving, a being who is felt before they are seen and remembered long after they have gone. Through Pisces, this becomes a presence that mirrors the deepest hopes of every being they meet, reflecting back the truth that each person already carries within. They are perceived as gentle, otherworldly, and mysteriously wise. They remind every being they meet that the veil between worlds is thinner than we think, and that love is the frequency that unifies ALL dimensions together.",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAIRING LIBRARY — Sun-Sun Oppositions (6 pairs)
   Format mirrors Zaria's Leo-Aquarius example:
   1. Individual A description (from INDIVIDUAL_PLACEMENTS)
   2. Individual B description (from INDIVIDUAL_PLACEMENTS)
   3. Unified pairing resonance
   ═══════════════════════════════════════════════════════════════════════════ */

export type AspectType = 'conjunction' | 'opposition' | 'trine' | 'square' | "sextile";

export type PairingKey = string;

export type PairingDescription = {
  aspectType: AspectType;
  title: string;
  aKey: string;
  bKey: string;
  pairingText: string;
};

export const PAIRING_DESCRIPTIONS: Record<PairingKey, PairingDescription> = {
  /* ── OPPOSITIONS: 6 pairs ─────────────────────────────────────────────── */

  "aries-libra-opposition": {
    aspectType: 'opposition',
    title: 'Red Ray · Aries Sun Opposing Indigo Ray · Libra Sun',
    aKey: 'aries-sun',
    bKey: 'libra-sun',
    pairingText:
      "With the Red Ray Aries and the Indigo Ray Libra, we find a sacred dance between initiative and reflection. The Aries Sun steps forward with the courage of first breath, igniting action where there was stillness, and the Libra Sun holds the mirror of relational truth, asking whether this action serves the whole. Together, they are the spark and the lens that focuses it. The Red Ray Aries reminds us that every relationship begins with a single being willing to move first, and the Indigo Ray Libra reminds us that movement finds its meaning only when it is witnessed, balanced, and held in the hands of love. Their opposition is a conversation between the self and the other, each completing what the other begins.",
  },

  "taurus-scorpio-opposition": {
    aspectType: 'opposition',
    title: 'Orange Ray · Taurus Sun Opposing Violet Ray · Scorpio Sun',
    aKey: 'taurus-sun',
    bKey: 'scorpio-sun',
    pairingText:
      "With the Orange Ray Taurus and the Violet Ray Scorpio, we find the meeting of embodiment and transformation, of pleasure and depth. The Taurus Sun builds a garden of sensory delight, anchoring beauty into the solidity of matter, while the Scorpio Sun descends into the underworld to retrieve what has been buried. Together, they are the root and the compost, the flower and the decay that feeds it. An Orange Ray Taurus lives to remind us that worthiness is felt in the body, and the Violet Ray Scorpio reminds us that the body holds every secret, every wound, and every doorway to rebirth. Their opposition is the cycle of life itself, death and beauty as one eternal breath.",
  },

  "gemini-sagittarius-opposition": {
    aspectType: 'opposition',
    title: 'Yellow Ray · Gemini Sun Opposing Magenta Ray · Sagittarius Sun',
    aKey: 'gemini-sun',
    bKey: 'sagittarius-sun',
    pairingText:
      "With the Yellow Ray Gemini and the Magenta Ray Sagittarius, we find the conversation between curiosity and meaning, between the question and the answer that dissolves into a bigger question. The Gemini Sun collects perspectives like seeds scattered by wind, delighting in the multiplicity of truth, while the Sagittarius Sun aims the arrow at the horizon of higher wisdom, seeking the one truth that unites all truths. Together, they are the library and the pilgrimage, the map and the journey beyond every map. A Yellow Ray Gemini lives to remind us that every idea is a bridge, and the Magenta Ray Sagittarius reminds us that every bridge leads to a vaster shore. Their opposition is the mind's dance between detail and totality, and together they hold the whole spectrum of knowing.",
  },

  "cancer-capricorn-opposition": {
    aspectType: 'opposition',
    title: 'Green Ray · Cancer Sun Opposing Lux \u0026 Umbra · Capricorn Sun',
    aKey: 'cancer-sun',
    bKey: 'capricorn-sun',
    pairingText:
      "With the Green Ray Cancer and the Lux \u0026 Umbra Capricorn, we find the sacred tension between nurturing and building, between the heart's immediate warmth and the mountain's patient endurance. The Cancer Sun creates home wherever love is present, flowing like water into every crack that needs healing, while the Capricorn Sun constructs the architecture of legacy, stone by stone, knowing that what lasts serves the future. Together, they are the womb and the monument, the tear and the fortress that protects what the tear watered. A Green Ray Cancer lives to remind us that belonging is the foundation of every achievement, and Lux \u0026 Umbra Capricorn reminds us that the structures we build are only as sacred as the love that built them. Their opposition is the balance of heart and spine, softness and strength as one organism.",
  },

  "leo-aquarius-opposition": {
    aspectType: 'opposition',
    title: 'Turquoise Ray · Leo Sun Opposing Elemental Ray · Aquarius Sun',
    aKey: 'leo-sun',
    bKey: 'aquarius-sun',
    pairingText:
      "With the Turquoise Leo and the Elemental Aquarius, we find a natural flow of reciprocal admiration of one another. Both are genuinely caring and want what is best for each with a unique approach to this. A Turquoise Leo lives to be a reminder that loving who you are authentically comes from within, and the Elemental Aquarius reminds you that is exactly why you deserve to be loved and appreciated beyond your individual being. Their opposition is a bridge between the heart's radiance and the mind's future, between the present moment of authentic expression and the infinite horizon of collective possibility. Together, they remind us that the individual and the whole are always one, and that the courage to be yourself is the same courage that changes the world.",
  },

  "virgo-pisces-opposition": {
    aspectType: 'opposition',
    title: 'Blue Ray · Virgo Sun Opposing Infinite of ALL Ray · Pisces Sun',
    aKey: 'virgo-sun',
    bKey: 'pisces-sun',
    pairingText:
      "With the Blue Ray Virgo and the Infinite of ALL Ray Pisces, we find the meeting of precision and boundlessness, of the needle's eye and the ocean's embrace. The Virgo Sun refines with sacred attention, bringing order to chaos through devotion to detail, while the Pisces Sun dissolves every boundary into the oneness from which all forms emerge. Together, they are the craft and the dream that inspires it, the prayer and the hands that build the temple. A Blue Ray Virgo lives to remind us that perfection is a practice of love, and the Infinite of ALL Ray Pisces reminds us that every practice dissolves, in the end, into the infinite compassion that holds ALL practices. Their opposition is the breath between form and formlessness, and together they hold the mystery that the particular and the universal are the same.",
  },

  /* ── CONJUNCTIONS: Same-sign pairings (6 highlights) ──────────────────── */

  "leo-leo-conjunction": {
    aspectType: 'conjunction',
    title: 'Turquoise Ray · Leo Sun Conjoining Turquoise Ray · Leo Sun',
    aKey: 'leo-sun',
    bKey: 'leo-sun',
    pairingText:
      "With two Turquoise Ray Leo Suns meeting in conjunction, we find a resonance of radiant hearts amplifying one another into a brilliance that grows from shared light. Both carry the frequency of authentic self-expression at ~615 THz, the courage to speak from the Heartlight, and the generosity to celebrate themselves and each other. Their meeting is a duet of sovereignty, where each being's radiance reflects the other's, creating a feedback loop of joy and affirmation. They remind us that when two hearts aligned in truth meet, the love they generate becomes a beacon for every being within reach. Their conjunction is collaboration at the highest frequency, two flames merging into a fire that warms the whole.",
  },

  "aquarius-aquarius-conjunction": {
    aspectType: 'conjunction',
    title: 'Elemental Ray · Aquarius Sun Conjoining Elemental Ray · Aquarius Sun',
    aKey: 'aquarius-sun',
    bKey: 'aquarius-sun',
    pairingText:
      "With two Elemental Ray Aquarius Suns meeting in conjunction, we find the collision of two futures arriving at the same moment, two networks of consciousness interweaving into a lattice of infinite possibility. Both are the best dreamers of humanity, channeling wisdom from across ALL of space and time into forms that beings authentically resonate with. Their meeting is revolutionary in vision, a quiet agreement between two minds that see beyond the present into what could be. They remind us that the future is built by those who refuse to accept the limits of the past, and that when two innovators align, the whole collective mind shifts. Their conjunction is the quantum entanglement of genius, two particles of light dancing the same dance across time.",
  },

  "capricorn-capricorn-conjunction": {
    aspectType: 'conjunction',
    title: 'Lux \u0026 Umbra · Capricorn Sun Conjoining Lux \u0026 Umbra · Capricorn Sun',
    aKey: 'capricorn-sun',
    bKey: 'capricorn-sun',
    pairingText:
      "With two Lux \u0026 Umbra Capricorn Suns meeting in conjunction, we find the architecture of empire built from mutual devotion to the Greatest and Highest Good. Both carry the full spectrum of visible light and the depth of void potential, building structures that endure because they are rooted in sacred responsibility. Their meeting is the summit of two mountains recognizing they are part of the same range, two architects whose separate plans complete a cathedral that calls for both architects. They remind us that true legacy is always collective, that the monuments we leave behind are only as meaningful as the love that poured their foundations. Their conjunction is the white light of shared ambition, the shadow of shared sacrifice, and the knowing that time honors those who serve beyond themselves.",
  },

  "aries-aries-conjunction": {
    aspectType: 'conjunction',
    title: 'Red Ray · Aries Sun Conjoining Red Ray · Aries Sun',
    aKey: 'aries-sun',
    bKey: 'aries-sun',
    pairingText:
      "With two Red Ray Aries Suns meeting in conjunction, we find the ignition of a wildfire, two sparks striking the same tinder and creating a blaze that transforms everything in its path. Both carry the first-breath courage of ~430 THz, the will to begin before the path is clear, the audacity to be first. Their meeting is an explosion of initiative, a mutual encouragement that says 'begin' and 'begin again' in the same breath. They remind us that courage is contagious, that when two beings who are unafraid to move first align, they create a current of action that sweeps others along. Their conjunction is the big bang of partnership, the moment before form where pure potential becomes pure presence.",
  },

  "pisces-pisces-conjunction": {
    aspectType: 'conjunction',
    title: 'Infinite of ALL Ray · Pisces Sun Conjoining Infinite of ALL Ray · Pisces Sun',
    aKey: 'pisces-sun',
    bKey: 'pisces-sun',
    pairingText:
      "With two Infinite of ALL Ray Pisces Suns meeting in conjunction, we find the ocean meeting the ocean, boundaries dissolving into a single wave that has always been one. Both carry every hue simultaneously, the infinite frequencies of compassion, mysticism, and unity consciousness. Their meeting is the recognition that they have always been one, that the love between them is the same love that holds galaxies together. They remind us that separation is the dream and unity is the awakening, and that when two mystics recognize each other, the whole illusion shimmers. Their conjunction is the dissolution of all barriers into the ONE, a sacred merging that transcends description and can only be felt.",
  },

  "scorpio-scorpio-conjunction": {
    aspectType: 'conjunction',
    title: 'Violet Ray · Scorpio Sun Conjoining Violet Ray · Scorpio Sun',
    aKey: 'scorpio-sun',
    bKey: 'scorpio-sun',
    pairingText:
      "With two Violet Ray Scorpio Suns meeting in conjunction, we find the phoenix meeting the phoenix in the ashes of what was, two beings who have faced the underworld and returned with eyes that see through every veil. Both carry the transmutational current of ~850 THz, the power to transform death into rebirth, shadow into light. Their meeting is alchemical, a crucible where two souls burn away everything false and emerge purified, fused, and more powerful than either was alone. They remind us that true intimacy requires the courage to be fully seen, and that when two beings who have done the deep work meet, their love becomes a force of nature. Their conjunction is the sacred marriage of two underworld guides, guardians of the threshold who hold the door open for every being ready to cross.",
  },

  /* ── TRINES: 4 highlighted pairs ────────────────────────────────────────── */

  "leo-sagittarius-trine": {
    aspectType: 'trine',
    title: 'Turquoise Ray · Leo Sun Trining Magenta Ray · Sagittarius Sun',
    aKey: 'leo-sun',
    bKey: 'sagittarius-sun',
    pairingText:
      "With the Turquoise Ray Leo and the Magenta Ray Sagittarius in flowing trine, we find a natural current of joy and expansion that carries both beings toward horizons that call for both their lights. The Leo Sun shines with authentic heart-expression, and the Sagittarius Sun aims that light toward the farthest stars, believing every dream is possible. Together, they are the performer and the prophet, the stage and the sermon, the heart and the arrow that flies true. They remind us that when creativity meets meaning, the result is art that becomes a movement. Their trine is a river of fire, warm and wild, carrying them both toward their highest becoming with the ease of water finding the sea.",
  },

  "taurus-capricorn-trine": {
    aspectType: 'trine',
    title: 'Orange Ray · Taurus Sun Trining Lux \u0026 Umbra · Capricorn Sun',
    aKey: 'taurus-sun',
    bKey: 'capricorn-sun',
    pairingText:
      "With the Orange Ray Taurus and the Lux \u0026 Umbra Capricorn in harmonious trine, we find the meeting of earth and earth, of builder and architect, of the garden and the fortress that protects it. The Taurus Sun anchors beauty into sensory pleasure, while the Capricorn Sun builds the legacy that outlasts seasons. Together, they are the soil and the stone, the harvest and the silo, the pleasure of now and the promise of forever. They remind us that what is built with love and what is enjoyed with gratitude are the same current wearing different robes. Their trine is a mountain covered in wildflowers, strength made beautiful and beauty made enduring.",
  },

  "gemini-libra-trine": {
    aspectType: 'trine',
    title: 'Yellow Ray · Gemini Sun Trining Indigo Ray · Libra Sun',
    aKey: 'gemini-sun',
    bKey: 'libra-sun',
    pairingText:
      "With the Yellow Ray Gemini and the Indigo Ray Libra in airy trine, we find a conversation that continues through all time, a meeting of minds that sparkles with the light of shared understanding. The Gemini Sun collects ideas like a bee collects pollen, and the Libra Sun arranges them into harmonies that delight the soul. Together, they are the poet and the composer, the question and the answer that leads to a better question, the breeze and the chime that sings in response. They remind us that intellectual chemistry is real, that the meeting of two beautiful minds creates a world others want to inhabit. Their trine is a garden of words where every sentence blooms.",
  },

  "cancer-scorpio-trine": {
    aspectType: 'trine',
    title: 'Green Ray · Cancer Sun Trining Violet Ray · Scorpio Sun',
    aKey: 'cancer-sun',
    bKey: 'scorpio-sun',
    pairingText:
      "With the Green Ray Cancer and the Violet Ray Scorpio in watery trine, we find the depths meeting the shore, the underworld meeting the sanctuary, transformation held in the arms of unconditional nurture. The Cancer Sun creates belonging with the gentleness of tides, while the Scorpio Sun dives into the shadows and returns with pearls of ancient wisdom. Together, they are the ocean and the diver, the home that waits and the treasure that makes the journey worthwhile. They remind us that emotional safety and emotional truth are twin currents of intimate love, the inhale and exhale of deep trust. Their trine is a current that carries them into each other's depths with the trust of water trusting water.",
  },

  /* ── SQUARES: 3 highlighted pairs ─────────────────────────────────────── */

  "aries-capricorn-square": {
    aspectType: 'square',
    title: 'Red Ray · Aries Sun Squaring Lux \u0026 Umbra · Capricorn Sun',
    aKey: 'aries-sun',
    bKey: 'capricorn-sun',
    pairingText:
      "With the Red Ray Aries and the Lux \u0026 Umbra Capricorn in dynamic square, we find the tension between the spark and the structure, between the impulse to begin and the wisdom to wait until the foundation is ready. The Aries Sun says 'now,' while the Capricorn Sun says 'when the time is right.' Together, they are the seed that bursts through soil too early and the gardener who knows when to plant. This tension is the friction that polishes both beings into greater versions of themselves. They remind us that patience and impatience are teachers of one another, and that the willingness to meet in the middle creates something that calls for both gifts. Their square is a dance of timing, and every step teaches them both.",
  },

  "leo-scorpio-square": {
    aspectType: 'square',
    title: 'Turquoise Ray · Leo Sun Squaring Violet Ray · Scorpio Sun',
    aKey: 'leo-sun',
    bKey: 'scorpio-sun',
    pairingText:
      "With the Turquoise Ray Leo and the Violet Ray Scorpio in intense square, we find the friction between the heart that wants to shine and the soul that wants to dive, between visibility and mystery, between the stage and the shadow. The Leo Sun radiates authentic joy for all to see, while the Scorpio Sun guards the depths with fierce privacy. Together, they are the flame and the well, each threatening to extinguish or drown the other, yet both holding powers the other needs. This tension asks both beings to grow, the Leo learning that true radiance includes the shadow, and the Scorpio learning that vulnerability shared becomes strength multiplied. Their square is the crucible where ego and soul negotiate a treaty of mutual respect.",
  },

  "gemini-virgo-square": {
    aspectType: 'square',
    title: 'Yellow Ray · Gemini Sun Squaring Blue Ray · Virgo Sun',
    aKey: 'gemini-sun',
    bKey: 'virgo-sun',
    pairingText:
      "With the Yellow Ray Gemini and the Blue Ray Virgo in mental square, we find the clash between breadth and depth, between the joy of many ideas and the devotion to one idea perfected. The Gemini Sun scatters seeds across a hundred fields, delighted by each new beginning, while the Virgo Sun tends one field with the patience of a master craftsperson. Together, they are the library and the laboratory, the brainstorm and the blueprint, the chaos of creation and the order that makes it real. This tension invites both to honor their nature while borrowing from the other, the Gemini learning that focus multiplies impact, and the Virgo learning that play opens doors rigidity resists. Their square is a conversation between expansion and refinement, and both are richer for the dialogue.",
  },
};

/* ── Lookup helpers for pairings ─────────────────────────────────────────── */

export function getPairingKey(
  signA: string,
  signB: string,
  aspect: AspectType
): PairingKey {
  const a = signA.toLowerCase();
  const b = signB.toLowerCase();
  // Normalize: ensure consistent ordering for symmetric aspects
  if (aspect === 'conjunction' || aspect === 'opposition' || aspect === 'trine' || aspect === 'square' || aspect === "sextile") {
    // Use lexicographic order for key stability
    const [first, second] = a < b ? [a, b] : [b, a];
    return `${first}-${second}-${aspect}` as PairingKey;
  }
  return `${a}-${b}-${aspect}` as PairingKey;
}

export function getPairing(
  signA: string,
  signB: string,
  aspect: AspectType
): PairingDescription | undefined {
  return PAIRING_DESCRIPTIONS[getPairingKey(signA, signB, aspect)];
}

/* ── Individual placement lookups (from above) ─────────────────────────── */

export function getPlacementKey(
  sign: string,
  body: BodyType
): PlacementKey {
  return `${sign.toLowerCase()}-${body.toLowerCase()}` as PlacementKey;
}

export function getPlacement(
  sign: string,
  body: BodyType
): IndividualPlacement | undefined {
  return INDIVIDUAL_PLACEMENTS[getPlacementKey(sign, body)];
}
