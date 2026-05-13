'use strict';
const { Animated, Easing } = require('react-native');

const useAnimatedStyle = () => ({});
const useSharedValue = (v) => ({ value: v });
const withTiming = (v) => v;
const withSpring = (v) => v;
const withRepeat = (v) => v;
const withSequence = (...v) => v[0];
const withDelay = (_, v) => v;
const runOnJS = (fn) => fn;
const runOnUI = (fn) => fn;
const interpolate = (v) => v;
const Extrapolation = { CLAMP: 'clamp' };
const useAnimatedScrollHandler = () => ({});
const useAnimatedRef = () => ({ current: null });
const useScrollViewOffset = () => ({ value: 0 });
const createAnimatedComponent = (C) => C;
const FlatList = require('react-native').FlatList;
const ScrollView = require('react-native').ScrollView;
const View = require('react-native').View;
const Text = require('react-native').Text;
const Image = require('react-native').Image;

module.exports = {
  default: { createAnimatedComponent },
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  runOnJS,
  runOnUI,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedRef,
  useScrollViewOffset,
  createAnimatedComponent,
  Easing,
  FlatList,
  ScrollView,
  View,
  Text,
  Image,
  Animated,
};
