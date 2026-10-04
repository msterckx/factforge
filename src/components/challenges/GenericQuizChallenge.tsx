"use client";

import { useRef, useMemo, useState } from "react";
import type { Dictionary } from "@/i18n/en";
import type { ChallengeGame, ChallengeItem, MapRegion } from "@/data/challengeGame";
import { resolveImageUrl } from "@/lib/imageUrl";
import { getQuizTheme } from "@/lib/quizThemes";
import McqQuizEngine from "./McqQuizEngine";
import MapMedia, { type MapMediaHandle, type MapMediaItem, getMapRevealHoldMs } from "./MapMedia";
import CarouselMedia, { type CarouselMediaItem } from "./CarouselMedia";
import VideoMedia, { type VideoMediaUrls } from "./VideoMedia";

interface Props {
  game: ChallengeGame;
  dict: Dictionary["challenges"];
  challengeId: string;
  lang: string;
  regions: MapRegion[];   // populated when game.mediaType === "map"
  items: ChallengeItem[]; // populated when game.mediaType === "carousel"
}

// ── PILOT: web-variant video clips for generic_quiz games with media_type="carousel",
// rendered via `gen-connections-video.js --variant=web` + a `--variant=full --only=opening`
// pass for the title card. Keyed by game slug, then item id. Items not listed here fall
// back to the CarouselMedia panel. Extend per-game or wire up via the DB once the pilot
// is validated. revealHoldMs matches each rendered reveal clip's actual duration
// (ffprobe), so McqQuizEngine holds long enough for it to finish.
const CAROUSEL_PILOTS: Record<string, { opening: string; items: Record<string, VideoMediaUrls & { questionHoldMs: number; revealHoldMs: number }> }> = {
  "contemporary-art": {
    opening: "/api/videos/contemporary-art/connections-opening-contemporary-art.mp4",
    items: {
      "193": { question: "/api/videos/contemporary-art/connections-193-question.mp4", reveal: "/api/videos/contemporary-art/connections-193-reveal.mp4", questionHoldMs: 10500, revealHoldMs: 12700 }, // The Physical Impossibility of Death in the Mind of Someone Living
      "194": { question: "/api/videos/contemporary-art/connections-194-question.mp4", reveal: "/api/videos/contemporary-art/connections-194-reveal.mp4", questionHoldMs: 8500,  revealHoldMs: 12700 }, // Balloon Dog
      "195": { question: "/api/videos/contemporary-art/connections-195-question.mp4", reveal: "/api/videos/contemporary-art/connections-195-reveal.mp4", questionHoldMs: 10100, revealHoldMs: 12700 }, // Obliteration Room
      "196": { question: "/api/videos/contemporary-art/connections-196-question.mp4", reveal: "/api/videos/contemporary-art/connections-196-reveal.mp4", questionHoldMs: 10300, revealHoldMs: 12700 }, // 727
      "197": { question: "/api/videos/contemporary-art/connections-197-question.mp4", reveal: "/api/videos/contemporary-art/connections-197-reveal.mp4", questionHoldMs: 8600,  revealHoldMs: 12700 }, // Untitled (Cowboy)
      "198": { question: "/api/videos/contemporary-art/connections-198-question.mp4", reveal: "/api/videos/contemporary-art/connections-198-reveal.mp4", questionHoldMs: 8000,  revealHoldMs: 12700 }, // Companion
      "199": { question: "/api/videos/contemporary-art/connections-199-question.mp4", reveal: "/api/videos/contemporary-art/connections-199-reveal.mp4", questionHoldMs: 11100, revealHoldMs: 12700 }, // Sunflower Seeds
      "200": { question: "/api/videos/contemporary-art/connections-200-question.mp4", reveal: "/api/videos/contemporary-art/connections-200-reveal.mp4", questionHoldMs: 9800,  revealHoldMs: 12700 }, // Comedian
      "201": { question: "/api/videos/contemporary-art/connections-201-question.mp4", reveal: "/api/videos/contemporary-art/connections-201-reveal.mp4", questionHoldMs: 9200,  revealHoldMs: 12700 }, // Cloud Gate
    },
  },
  "worldfair-architecture": {
    opening: "/api/videos/worldfair-architecture/connections-opening-worldfair-architecture.mp4",
    items: {
      "202": { question: "/api/videos/worldfair-architecture/connections-202-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-202-reveal.mp4", questionHoldMs: 9600,  revealHoldMs: 12700 }, // Unisphere
      "203": { question: "/api/videos/worldfair-architecture/connections-203-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-203-reveal.mp4", questionHoldMs: 10900, revealHoldMs: 12700 }, // Atomium
      "204": { question: "/api/videos/worldfair-architecture/connections-204-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-204-reveal.mp4", questionHoldMs: 9500,  revealHoldMs: 12700 }, // Eiffel tower
      "205": { question: "/api/videos/worldfair-architecture/connections-205-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-205-reveal.mp4", questionHoldMs: 7900,  revealHoldMs: 12700 }, // Grand Palais
      "206": { question: "/api/videos/worldfair-architecture/connections-206-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-206-reveal.mp4", questionHoldMs: 8900,  revealHoldMs: 12700 }, // Habitat
      "207": { question: "/api/videos/worldfair-architecture/connections-207-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-207-reveal.mp4", questionHoldMs: 9900,  revealHoldMs: 12700 }, // Magic Fountain of Montjuic
      "208": { question: "/api/videos/worldfair-architecture/connections-208-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-208-reveal.mp4", questionHoldMs: 8700,  revealHoldMs: 12700 }, // Palace of Fine Arts
      "210": { question: "/api/videos/worldfair-architecture/connections-210-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-210-reveal.mp4", questionHoldMs: 8600,  revealHoldMs: 12700 }, // Space Needle
      "211": { question: "/api/videos/worldfair-architecture/connections-211-question.mp4", reveal: "/api/videos/worldfair-architecture/connections-211-reveal.mp4", questionHoldMs: 9800,  revealHoldMs: 12700 }, // Biosphere
    },
  },
  "renaissance-paintings": {
    opening: "/api/videos/renaissance-paintings/connections-opening-renaissance-paintings.mp4",
    items: {
      "178": { question: "/api/videos/renaissance-paintings/connections-178-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-178-reveal.mp4", questionHoldMs: 9100,  revealHoldMs: 12700 }, // The Mona Lisa
      "179": { question: "/api/videos/renaissance-paintings/connections-179-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-179-reveal.mp4", questionHoldMs: 10400, revealHoldMs: 12700 }, // The Birth of Venus
      "180": { question: "/api/videos/renaissance-paintings/connections-180-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-180-reveal.mp4", questionHoldMs: 10800, revealHoldMs: 12700 }, // The School of Athens
      "181": { question: "/api/videos/renaissance-paintings/connections-181-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-181-reveal.mp4", questionHoldMs: 8600,  revealHoldMs: 12700 }, // The Creation of Adam
      "182": { question: "/api/videos/renaissance-paintings/connections-182-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-182-reveal.mp4", questionHoldMs: 9800,  revealHoldMs: 12700 }, // The Arnolfini Portrait
      "183": { question: "/api/videos/renaissance-paintings/connections-183-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-183-reveal.mp4", questionHoldMs: 9200,  revealHoldMs: 12700 }, // David
      "184": { question: "/api/videos/renaissance-paintings/connections-184-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-184-reveal.mp4", questionHoldMs: 8600,  revealHoldMs: 12700 }, // Venus of Urbino
      "186": { question: "/api/videos/renaissance-paintings/connections-186-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-186-reveal.mp4", questionHoldMs: 10300, revealHoldMs: 12700 }, // The Garden of Earthly Delights
      "187": { question: "/api/videos/renaissance-paintings/connections-187-question.mp4", reveal: "/api/videos/renaissance-paintings/connections-187-reveal.mp4", questionHoldMs: 8700,  revealHoldMs: 12700 }, // The Ambassadors
    },
  },
  "top-7-nazis-world-war-2": {
    opening: "/api/videos/top-7-nazis-world-war-2/connections-opening-top-7-nazis-world-war-2.mp4",
    items: {
      "260": { question: "/api/videos/top-7-nazis-world-war-2/connections-260-question.mp4", reveal: "/api/videos/top-7-nazis-world-war-2/connections-260-reveal.mp4", questionHoldMs: 8200, revealHoldMs: 12700 }, // Adolf Hitler
      "261": { question: "/api/videos/top-7-nazis-world-war-2/connections-261-question.mp4", reveal: "/api/videos/top-7-nazis-world-war-2/connections-261-reveal.mp4", questionHoldMs: 7800, revealHoldMs: 12700 }, // Heinrich Himmler
      "262": { question: "/api/videos/top-7-nazis-world-war-2/connections-262-question.mp4", reveal: "/api/videos/top-7-nazis-world-war-2/connections-262-reveal.mp4", questionHoldMs: 8800, revealHoldMs: 12700 }, // Joseph Goebbels
      "263": { question: "/api/videos/top-7-nazis-world-war-2/connections-263-question.mp4", reveal: "/api/videos/top-7-nazis-world-war-2/connections-263-reveal.mp4", questionHoldMs: 6500, revealHoldMs: 12700 }, // Hermann Göring
      "264": { question: "/api/videos/top-7-nazis-world-war-2/connections-264-question.mp4", reveal: "/api/videos/top-7-nazis-world-war-2/connections-264-reveal.mp4", questionHoldMs: 7400, revealHoldMs: 12700 }, // Rudolf Hess
      "265": { question: "/api/videos/top-7-nazis-world-war-2/connections-265-question.mp4", reveal: "/api/videos/top-7-nazis-world-war-2/connections-265-reveal.mp4", questionHoldMs: 7800, revealHoldMs: 12700 }, // Albert Speer
      "266": { question: "/api/videos/top-7-nazis-world-war-2/connections-266-question.mp4", reveal: "/api/videos/top-7-nazis-world-war-2/connections-266-reveal.mp4", questionHoldMs: 7500, revealHoldMs: 12700 }, // Reinhard Heydrich
    },
  },
  "quantum-scientists": {
    opening: "/api/videos/quantum-scientists/connections-opening-quantum-scientists.mp4",
    items: {
      "67": { question: "/api/videos/quantum-scientists/connections-67-question.mp4", reveal: "/api/videos/quantum-scientists/connections-67-reveal.mp4", questionHoldMs: 9400,  revealHoldMs: 12700 }, // Max Planck
      "68": { question: "/api/videos/quantum-scientists/connections-68-question.mp4", reveal: "/api/videos/quantum-scientists/connections-68-reveal.mp4", questionHoldMs: 10300, revealHoldMs: 12700 }, // Albert Einstein
      "69": { question: "/api/videos/quantum-scientists/connections-69-question.mp4", reveal: "/api/videos/quantum-scientists/connections-69-reveal.mp4", questionHoldMs: 10100, revealHoldMs: 12700 }, // Niels Bohr
      "70": { question: "/api/videos/quantum-scientists/connections-70-question.mp4", reveal: "/api/videos/quantum-scientists/connections-70-reveal.mp4", questionHoldMs: 7800,  revealHoldMs: 12700 }, // Louis de Broglie
      "71": { question: "/api/videos/quantum-scientists/connections-71-question.mp4", reveal: "/api/videos/quantum-scientists/connections-71-reveal.mp4", questionHoldMs: 10800, revealHoldMs: 12700 }, // Werner Heisenberg
      "72": { question: "/api/videos/quantum-scientists/connections-72-question.mp4", reveal: "/api/videos/quantum-scientists/connections-72-reveal.mp4", questionHoldMs: 10000, revealHoldMs: 12700 }, // Erwin Schrödinger
      "73": { question: "/api/videos/quantum-scientists/connections-73-question.mp4", reveal: "/api/videos/quantum-scientists/connections-73-reveal.mp4", questionHoldMs: 9600,  revealHoldMs: 12700 }, // Max Born
      "74": { question: "/api/videos/quantum-scientists/connections-74-question.mp4", reveal: "/api/videos/quantum-scientists/connections-74-reveal.mp4", questionHoldMs: 9700,  revealHoldMs: 12700 }, // Paul Dirac
    },
  },
};

// ── PILOT: web-variant video clips for map_quiz-style generic_quiz games
// (media_type="map"), rendered via `gen-map-video.js --variant=web` + a
// `--variant=full --only=opening` pass for the title card. Keyed by game
// slug, then region_key. Regions not listed here fall back to the
// interactive MapMedia panel. Extend per-game or wire up via the DB once
// the pilot is validated. questionHoldMs/revealHoldMs match each rendered
// clip's actual duration (ffprobe) — see McqQuizEngine's liveRevealDelay.
const MAP_PILOTS: Record<string, { opening: string; regions: Record<string, VideoMediaUrls & { questionHoldMs: number; revealHoldMs: number }> }> = {
  "european-national-reserves": {
    opening: "/api/videos/european-national-reserves/map-europe-opening.mp4",
    regions: {
      "Bialowieza_National_Park":     { question: "/api/videos/european-national-reserves/map-europe-Bialowieza_National_Park-question.mp4",     reveal: "/api/videos/european-national-reserves/map-europe-Bialowieza_National_Park-reveal.mp4",     questionHoldMs: 14600, revealHoldMs: 9700 },
      "Cairngorms_National_Park":     { question: "/api/videos/european-national-reserves/map-europe-Cairngorms_National_Park-question.mp4",     reveal: "/api/videos/european-national-reserves/map-europe-Cairngorms_National_Park-reveal.mp4",     questionHoldMs: 13300, revealHoldMs: 9700 },
      "Jotunheimen_National_Park":    { question: "/api/videos/european-national-reserves/map-europe-Jotunheimen_National_Park-question.mp4",    reveal: "/api/videos/european-national-reserves/map-europe-Jotunheimen_National_Park-reveal.mp4",    questionHoldMs: 11000, revealHoldMs: 9700 },
      "Plitvice_Lakes_National_Park": { question: "/api/videos/european-national-reserves/map-europe-Plitvice_Lakes_National_Park-question.mp4", reveal: "/api/videos/european-national-reserves/map-europe-Plitvice_Lakes_National_Park-reveal.mp4", questionHoldMs: 12800, revealHoldMs: 9700 },
      "Sarek_National_Park":          { question: "/api/videos/european-national-reserves/map-europe-Sarek_National_Park-question.mp4",          reveal: "/api/videos/european-national-reserves/map-europe-Sarek_National_Park-reveal.mp4",          questionHoldMs: 12900, revealHoldMs: 12700 },
      "Sierra_Nevada_National_Park":  { question: "/api/videos/european-national-reserves/map-europe-Sierra_Nevada_National_Park-question.mp4",  reveal: "/api/videos/european-national-reserves/map-europe-Sierra_Nevada_National_Park-reveal.mp4",  questionHoldMs: 11500, revealHoldMs: 9700 },
      "Triglav_National_Park":        { question: "/api/videos/european-national-reserves/map-europe-Triglav_National_Park-question.mp4",        reveal: "/api/videos/european-national-reserves/map-europe-Triglav_National_Park-reveal.mp4",        questionHoldMs: 14000, revealHoldMs: 12700 },
      "Vanoise_National_Park":        { question: "/api/videos/european-national-reserves/map-europe-Vanoise_National_Park-question.mp4",        reveal: "/api/videos/european-national-reserves/map-europe-Vanoise_National_Park-reveal.mp4",        questionHoldMs: 13200, revealHoldMs: 12700 },
    },
  },
  "south-america-parks": {
    opening: "/api/videos/south-america-parks/map-southamerica-opening.mp4",
    regions: {
      "Canaima_National_Park":                { question: "/api/videos/south-america-parks/map-southamerica-Canaima_National_Park-question.mp4",                reveal: "/api/videos/south-america-parks/map-southamerica-Canaima_National_Park-reveal.mp4",                questionHoldMs: 13400, revealHoldMs: 9700 },
      "Central_Suriname_Nature_Reserve":      { question: "/api/videos/south-america-parks/map-southamerica-Central_Suriname_Nature_Reserve-question.mp4",      reveal: "/api/videos/south-america-parks/map-southamerica-Central_Suriname_Nature_Reserve-reveal.mp4",      questionHoldMs: 9800,  revealHoldMs: 9700 },
      "Madidi_National_Park":                 { question: "/api/videos/south-america-parks/map-southamerica-Madidi_National_Park-question.mp4",                 reveal: "/api/videos/south-america-parks/map-southamerica-Madidi_National_Park-reveal.mp4",                 questionHoldMs: 10800, revealHoldMs: 9700 },
      "Manu_National_Park":                   { question: "/api/videos/south-america-parks/map-southamerica-Manu_National_Park-question.mp4",                   reveal: "/api/videos/south-america-parks/map-southamerica-Manu_National_Park-reveal.mp4",                   questionHoldMs: 10000, revealHoldMs: 9700 },
      "Pantanal_Matogrossense_National_Park": { question: "/api/videos/south-america-parks/map-southamerica-Pantanal_Matogrossense_National_Park-question.mp4", reveal: "/api/videos/south-america-parks/map-southamerica-Pantanal_Matogrossense_National_Park-reveal.mp4", questionHoldMs: 11300, revealHoldMs: 9700 },
      "Parque_Nacional_Los_Glaciares":        { question: "/api/videos/south-america-parks/map-southamerica-Parque_Nacional_Los_Glaciares-question.mp4",        reveal: "/api/videos/south-america-parks/map-southamerica-Parque_Nacional_Los_Glaciares-reveal.mp4",        questionHoldMs: 9800,  revealHoldMs: 9700 },
      "Tayrona_National_Natural_Park":        { question: "/api/videos/south-america-parks/map-southamerica-Tayrona_National_Natural_Park-question.mp4",        reveal: "/api/videos/south-america-parks/map-southamerica-Tayrona_National_Natural_Park-reveal.mp4",        questionHoldMs: 10500, revealHoldMs: 9700 },
      "Torres_del_Paine_National_Park":       { question: "/api/videos/south-america-parks/map-southamerica-Torres_del_Paine_National_Park-question.mp4",       reveal: "/api/videos/south-america-parks/map-southamerica-Torres_del_Paine_National_Park-reveal.mp4",       questionHoldMs: 10500, revealHoldMs: 9700 },
    },
  },
  "africa-safari-wildlife": {
    opening: "/api/videos/africa-safari-wildlife/map-africa-opening.mp4",
    regions: {
      "Bwindi_National_Park":         { question: "/api/videos/africa-safari-wildlife/map-africa-Bwindi_National_Park-question.mp4",         reveal: "/api/videos/africa-safari-wildlife/map-africa-Bwindi_National_Park-reveal.mp4",         questionHoldMs: 11900, revealHoldMs: 9700 },
      "Etosha_National_Park":         { question: "/api/videos/africa-safari-wildlife/map-africa-Etosha_National_Park-question.mp4",         reveal: "/api/videos/africa-safari-wildlife/map-africa-Etosha_National_Park-reveal.mp4",         questionHoldMs: 13900, revealHoldMs: 9700 },
      "Kruger_National_Park":         { question: "/api/videos/africa-safari-wildlife/map-africa-Kruger_National_Park-question.mp4",         reveal: "/api/videos/africa-safari-wildlife/map-africa-Kruger_National_Park-reveal.mp4",         questionHoldMs: 14900, revealHoldMs: 9700 },
      "Maasai_Mara_National_Reserve": { question: "/api/videos/africa-safari-wildlife/map-africa-Maasai_Mara_National_Reserve-question.mp4", reveal: "/api/videos/africa-safari-wildlife/map-africa-Maasai_Mara_National_Reserve-reveal.mp4", questionHoldMs: 13800, revealHoldMs: 9700 },
      "Okavango_Delta":               { question: "/api/videos/africa-safari-wildlife/map-africa-Okavango_Delta-question.mp4",               reveal: "/api/videos/africa-safari-wildlife/map-africa-Okavango_Delta-reveal.mp4",               questionHoldMs: 13200, revealHoldMs: 9700 },
      "Serengeti_National_Park":      { question: "/api/videos/africa-safari-wildlife/map-africa-Serengeti_National_Park-question.mp4",      reveal: "/api/videos/africa-safari-wildlife/map-africa-Serengeti_National_Park-reveal.mp4",      questionHoldMs: 15900, revealHoldMs: 9700 },
      "South_Luangwa_National_Park":  { question: "/api/videos/africa-safari-wildlife/map-africa-South_Luangwa_National_Park-question.mp4",  reveal: "/api/videos/africa-safari-wildlife/map-africa-South_Luangwa_National_Park-reveal.mp4",  questionHoldMs: 14000, revealHoldMs: 9700 },
      "Virunga_National_Park":        { question: "/api/videos/africa-safari-wildlife/map-africa-Virunga_National_Park-question.mp4",        reveal: "/api/videos/africa-safari-wildlife/map-africa-Virunga_National_Park-reveal.mp4",        questionHoldMs: 14500, revealHoldMs: 9700 },
    },
  },
  "north-america-national-reserves": {
    opening: "/api/videos/north-america-national-reserves/map-northamerica-opening.mp4",
    regions: {
      "Denali_National_Park":               { question: "/api/videos/north-america-national-reserves/map-northamerica-Denali_National_Park-question.mp4",               reveal: "/api/videos/north-america-national-reserves/map-northamerica-Denali_National_Park-reveal.mp4",               questionHoldMs: 12500, revealHoldMs: 9700 },
      "Grand_Canyon_National_Park":          { question: "/api/videos/north-america-national-reserves/map-northamerica-Grand_Canyon_National_Park-question.mp4",          reveal: "/api/videos/north-america-national-reserves/map-northamerica-Grand_Canyon_National_Park-reveal.mp4",          questionHoldMs: 13300, revealHoldMs: 9700 },
      "Nahanni_National_Park":               { question: "/api/videos/north-america-national-reserves/map-northamerica-Nahanni_National_Park-question.mp4",               reveal: "/api/videos/north-america-national-reserves/map-northamerica-Nahanni_National_Park-reveal.mp4",               questionHoldMs: 12700, revealHoldMs: 9700 },
      "Reserva_de_la_Biosfera_El_vizcaino":  { question: "/api/videos/north-america-national-reserves/map-northamerica-Reserva_de_la_Biosfera_El_vizcaino-question.mp4",  reveal: "/api/videos/north-america-national-reserves/map-northamerica-Reserva_de_la_Biosfera_El_vizcaino-reveal.mp4",  questionHoldMs: 12400, revealHoldMs: 9700 },
      "Reserva_de_la_Biosfera_Sian_Ka_an":   { question: "/api/videos/north-america-national-reserves/map-northamerica-Reserva_de_la_Biosfera_Sian_Ka_an-question.mp4",   reveal: "/api/videos/north-america-national-reserves/map-northamerica-Reserva_de_la_Biosfera_Sian_Ka_an-reveal.mp4",   questionHoldMs: 12200, revealHoldMs: 9700 },
      "Tikal_National_Park":                 { question: "/api/videos/north-america-national-reserves/map-northamerica-Tikal_National_Park-question.mp4",                 reveal: "/api/videos/north-america-national-reserves/map-northamerica-Tikal_National_Park-reveal.mp4",                 questionHoldMs: 12100, revealHoldMs: 9700 },
      "Torngat_Mountains_National_Park":     { question: "/api/videos/north-america-national-reserves/map-northamerica-Torngat_Mountains_National_Park-question.mp4",     reveal: "/api/videos/north-america-national-reserves/map-northamerica-Torngat_Mountains_National_Park-reveal.mp4",     questionHoldMs: 12300, revealHoldMs: 9700 },
      "Yellowstone_National_Park":           { question: "/api/videos/north-america-national-reserves/map-northamerica-Yellowstone_National_Park-question.mp4",           reveal: "/api/videos/north-america-national-reserves/map-northamerica-Yellowstone_National_Park-reveal.mp4",           questionHoldMs: 11500, revealHoldMs: 9700 },
      "Yosemite_National_Park":              { question: "/api/videos/north-america-national-reserves/map-northamerica-Yosemite_National_Park-question.mp4",              reveal: "/api/videos/north-america-national-reserves/map-northamerica-Yosemite_National_Park-reveal.mp4",              questionHoldMs: 12600, revealHoldMs: 9700 },
    },
  },
  "ww2-pacific-theater-events": {
    opening: "/api/videos/ww2-pacific-theater-events/map-pacific-opening.mp4",
    regions: {
      "Attack_on_Pearl_Harbor": { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Attack_on_Pearl_Harbor-question.mp4", reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Attack_on_Pearl_Harbor-reveal.mp4", questionHoldMs: 12800, revealHoldMs: 12700 },
      "Battle_of_Midway":       { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Midway-question.mp4",       reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Midway-reveal.mp4",       questionHoldMs: 14200, revealHoldMs: 9700 },
      "Guadalcanal_Campaign":   { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Guadalcanal_Campaign-question.mp4",   reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Guadalcanal_Campaign-reveal.mp4",   questionHoldMs: 13600, revealHoldMs: 12700 },
      "Battle_of_Leyte_Gulf":   { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Leyte_Gulf-question.mp4",   reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Leyte_Gulf-reveal.mp4",   questionHoldMs: 12200, revealHoldMs: 12700 },
      "Battle_of_Iwo_Jima":     { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Iwo_Jima-question.mp4",     reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Iwo_Jima-reveal.mp4",     questionHoldMs: 11800, revealHoldMs: 12700 },
      "Battle_of_Okinawa":      { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Okinawa-question.mp4",      reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Battle_of_Okinawa-reveal.mp4",      questionHoldMs: 10700, revealHoldMs: 9700 },
      "Bombing_of_Hiroshima":   { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Bombing_of_Hiroshima-question.mp4",   reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Bombing_of_Hiroshima-reveal.mp4",   questionHoldMs: 9300,  revealHoldMs: 12700 },
      "Bombing_of_Nagasaki":    { question: "/api/videos/ww2-pacific-theater-events/map-pacific-Bombing_of_Nagasaki-question.mp4",    reveal: "/api/videos/ww2-pacific-theater-events/map-pacific-Bombing_of_Nagasaki-reveal.mp4",    questionHoldMs: 9500,  revealHoldMs: 12700 },
    },
  },
};

// Games whose content only makes sense in a fixed sequence (e.g. a chronological run
// of historical events), rather than the engine's default per-round shuffle.
const ORDERED_GAMES = new Set(["ww2-pacific-theater-events", "quantum-scientists"]);

// ── The generic 3-option quiz: media panel and visual theme are configured per
//    game (media_type / theme_key columns) rather than hardcoded per component. ──
export default function GenericQuizChallenge({ game, dict, challengeId, lang, regions, items }: Props) {
  const theme = useMemo(() => getQuizTheme(game.themeKey), [game.themeKey]);
  const mediaRef = useRef<MapMediaHandle>(null);
  const isMap = game.mediaType === "map";
  const [showOpening, setShowOpening] = useState(true);

  const mapItems = useMemo<MapMediaItem[]>(() => {
    if (!isMap) return [];
    return regions.map((r) => {
      const key = r.regionKey.trim();
      return {
        key, regionKey: key,
        label: lang === "nl" ? r.labelNl : r.labelEn,
        questionTextEn: r.questionTextEn,
        questionTextNl: r.questionTextNl,
      };
    });
  }, [isMap, regions, lang]);

  const carouselItems = useMemo<CarouselMediaItem[]>(() => {
    if (isMap) return [];
    return items.map((it) => {
      // infographData is either a bare array (connections_quiz/generic_quiz
      // convention) or, for items converted from matching/chronology, the
      // richer {born, died, ..., images[]} object — accept either shape.
      let extraImages: string[] = [];
      if (it.infographData) {
        try {
          const parsed = JSON.parse(it.infographData);
          if (Array.isArray(parsed)) extraImages = parsed;
          else if (Array.isArray(parsed?.images)) extraImages = parsed.images;
        } catch { /* ignore malformed data */ }
      }
      const images = Array.from(new Set(
        [it.imageUrl, ...extraImages].filter(Boolean).map((src) => resolveImageUrl(src))
      ));
      const label = lang === "nl" ? (it.clueNl || it.clueEn) ?? "" : it.clueEn ?? "";
      return {
        key: String(it.id), label, name: it.name, images,
        questionTextEn: it.questionTextEn,
        questionTextNl: it.questionTextNl,
      };
    });
  }, [isMap, items, lang]);

  const sharedProps = {
    challengeId,
    perfectScoreText: `🎉 ${dict.perfectScore}`,
    scoreText: (correct: number, total: number) =>
      dict.connectionsScore.replace("{correct}", String(correct)).replace("{total}", String(total)),
    tryAgainLabel: (wrongCount: number) => `${dict.tryAgain} (${wrongCount})`,
    playAgainLabel: dict.playAgain,
    theme,
    shuffleItems: !ORDERED_GAMES.has(game.slug),
  };

  if (isMap) {
    const mapPilot = MAP_PILOTS[game.slug];
    const PILOT_MAP_VIDEO = mapPilot?.regions ?? {};
    const isPilotMapVideoGame = mapItems.some((it) => PILOT_MAP_VIDEO[it.regionKey]);
    const mapWrapClass = isPilotMapVideoGame ? "max-w-3xl mx-auto" : "";

    if (isPilotMapVideoGame && showOpening) {
      return (
        <div className={mapWrapClass}>
          <div
            className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl bg-slate-900 cursor-pointer"
            onClick={() => setShowOpening(false)}
          >
            <video
              src={mapPilot!.opening}
              autoPlay
              playsInline
              muted
              onEnded={() => setShowOpening(false)}
              className="absolute inset-0 w-full h-full object-cover object-left"
            />
          </div>
        </div>
      );
    }

    return (
      <div className={mapWrapClass}>
        <McqQuizEngine
          items={mapItems}
          {...sharedProps}
          // Options/countdown wait for the pilot clip's narration to finish (YouTube-cut
          // pacing) — falls back to the game's flat DB delay for any non-pilot region.
          liveRevealDelay={(item) => PILOT_MAP_VIDEO[item.regionKey]?.questionHoldMs ?? (game.liveRevealDelay ?? 0) * 1000}
          questionTimeMs={8000}
          promptText={(item) => (lang === "nl" ? item.questionTextNl : item.questionTextEn) || dict.mapQuizPrompt}
          mediaBorderReveal
          onReveal={(key, correct) => mediaRef.current?.reveal(key, correct)}
          onAdvance={() => mediaRef.current?.resetZoom()}
          revealHoldMs={(item, correct) => {
            const pilot = PILOT_MAP_VIDEO[item.regionKey];
            // Pilot regions: no carousel cutaway happens (VideoMedia owns the reveal
            // entirely) — a wrong/timeout answer just sits on the paused question
            // clip, so it should advance quickly like the carousel pilot does, not
            // wait out getMapRevealHoldMs's carousel-cutaway pacing.
            if (pilot) return (correct && pilot.revealHoldMs) || 1400;
            return getMapRevealHoldMs(item, regions);
          }}
          renderMedia={({ currentItem, answeredKeys, revealState }) => {
            const pilot = currentItem ? PILOT_MAP_VIDEO[currentItem.regionKey] : null;
            return pilot ? (
              <VideoMedia key={currentItem!.key} item={currentItem} revealState={revealState} urls={pilot} />
            ) : (
              <MapMedia ref={mediaRef} regions={regions} game={game} currentItem={currentItem} answeredKeys={answeredKeys} revealState={revealState} />
            );
          }}
        />
      </div>
    );
  }

  const carouselPilot = CAROUSEL_PILOTS[game.slug];
  const PILOT_VIDEO = carouselPilot?.items ?? {};
  const isPilotVideoGame = carouselItems.some((it) => PILOT_VIDEO[it.key]);

  // Video items read life-size at full column width — cap to roughly a
  // default YouTube embed's footprint instead, like the rest of the web.
  const videoWrapClass = isPilotVideoGame ? "max-w-3xl mx-auto" : "";

  if (isPilotVideoGame && showOpening) {
    return (
      <div className={videoWrapClass}>
        <div
          className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl bg-slate-900 cursor-pointer"
          onClick={() => setShowOpening(false)}
        >
          <video
            src={carouselPilot!.opening}
            autoPlay
            playsInline
            muted
            onEnded={() => setShowOpening(false)}
            className="absolute inset-0 w-full h-full object-cover object-left"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={videoWrapClass}>
      <McqQuizEngine
        items={carouselItems}
        {...sharedProps}
        // Options/countdown wait for the pilot clip's narration to finish (YouTube-cut
        // pacing) — falls back to the game's flat DB delay for any non-pilot item.
        liveRevealDelay={(item) => PILOT_VIDEO[item.key]?.questionHoldMs ?? (game.liveRevealDelay ?? 0) * 1000}
        questionTimeMs={8000}
        promptText={(item) => (lang === "nl" ? item.questionTextNl : item.questionTextEn) || dict.connectionsQuizPrompt}
        revealHoldMs={(item, correct) => (correct && PILOT_VIDEO[item.key]?.revealHoldMs) || 1400}
        renderMedia={({ currentItem, revealState }) => {
          const pilot = currentItem ? PILOT_VIDEO[currentItem.key] : null;
          return pilot ? (
            <VideoMedia key={currentItem!.key} item={currentItem} revealState={revealState} urls={pilot} />
          ) : (
            <CarouselMedia key={currentItem?.key} item={currentItem} revealState={revealState} theme={theme} />
          );
        }}
      />
    </div>
  );
}
