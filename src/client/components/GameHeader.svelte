<script lang="ts">
  // En-tête des écrans de jeu : titre punk, info du milieu, chrono.
  import type { Snippet } from 'svelte';
  import type { GameView } from '../../shared/view';
  import type { Room } from '../lib/room.svelte';
  import Countdown from './Countdown.svelte';

  let { view, room, title, info }: { view: GameView; room: Room; title: Snippet; info?: string } = $props();
</script>

<header>
  <h1 class="punk">{@render title()}</h1>
  {#if info}<span class="info">{info}</span>{/if}
  {#if view.deadline}
    <Countdown deadline={view.deadline} start={view.phaseStartedAt} now={() => room.serverNow()} />
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 40px;
  }
  h1 {
    font-size: 32px;
    white-space: nowrap;
  }
  .info {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-2);
    text-align: center;
  }
</style>
