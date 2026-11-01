import type {Metadata} from 'next';
import {LearningGame} from '@/components/learning/LearningGame';
export const metadata:Metadata={title:'Learn to play with Mango Bot',description:'Learn UNO Mates house rules one move at a time in a guided practice with robots.',robots:{index:false,follow:true}};
export default function LearnPage(){return <LearningGame/>;}
