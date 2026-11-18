import "@cairn/ui/styles/global.css";
import "./site.css";
import { mount } from "svelte";
import Server from "./Server.svelte";

mount(Server, { target: document.body });
