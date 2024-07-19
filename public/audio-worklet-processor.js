class PitchShifterProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        for (let channel = 0; channel < input.length; ++channel) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];

            for (let i = 0; i < inputChannel.length; ++i) {
                outputChannel[i] = inputChannel[i] * Math.sin(2 * Math.PI * i / inputChannel.length); // Basic pitch shifting
            }
        }

        return true;
    }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
