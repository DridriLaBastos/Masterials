EPOCHS = 3000

losses = { 'atc': [], 'wt': [] }
trainAccuracy = { 'atc': [], 'wt': [] }
validationAccuracy = { 'atc': [], 'wt': [] }

for epoch in range(EPOCHS):
    #Computing accuracies
    trainPredictions = model(xTrain, training=False)
    trainPredictionsATC = np.argmax(trainPredictions[ATC_CODE],axis=1).reshape(yTrain[:,:,0].shape)
    trainPredictionsWT  = np.argmax(trainPredictions[WAIT_TIME],axis=1).reshape(yTrain[:,:,1].shape)

    trainAccuracy['atc'].append((trainPredictionsATC == yTrain[:,:,0]).sum()/len(yTrain[:,:,0]))
    trainAccuracy['wt'].append((trainPredictionsWT == yTrain[:,:,1]).sum()/len(yTrain[:,:,1]))

    validationPredictions = model(XVal, training=False)
    validationPredictionsATC = np.argmax(validationPredictions[ATC_CODE],axis=1).reshape(YVal['outputATC'].shape)
    validationPredictionsWT  = np.argmax(validationPredictions[WAIT_TIME],axis=1).reshape(YVal['outputWaitTime'].shape)

    validationAccuracy['atc'].append((validationPredictionsATC == YVal['outputATC']).sum()/len(YVal['outputATC']))
    validationAccuracy['wt'].append((validationPredictionsWT == YVal['outputATC']).sum()/len(YVal['outputATC']))

    with tf.GradientTape() as ATCTape, tf.GradientTape() as WTTape, tf.GradientTape() as tape:
        predictions = model(xTrain,training=False)
        ATCLoss = loss(yTrain[:,:,0],predictions[ATC_CODE])
        WTLoss = loss(yTrain[:,:,1],predictions[WAIT_TIME])
        lossValue = ATCLoss + WTLoss

    ATCGrads = ATCTape.gradient(ATCLoss, model.trainable_variables)
    WTGrads  = WTTape.gradient(WTLoss,model.trainable_variables)

    gs = ATCGrads
    gl = WTGrads

    for i in range(len(gs)):
        gsValue = gs[i]
        glValue = gl[i]

        if gsValue is None:
            gs[i] = tf.constant(np.zeros(glValue.shape,dtype='float32'))
        
        if glValue is None:
            gl[i] = tf.constant(np.zeros(gsValue.shape,dtype='float32'))
    
    addGrads = [gsValue + glValue for gsValue,glValue in zip(gs,gl)]

    model.optimizer.apply_gradients(zip(addGrads, model.trainable_variables))

    losses['atc'].append(ATCLoss)
    losses['wt'].append(WTLoss)

    e = epoch + 1
    if (e % 100 == 0) or (epoch == 0):
        print(f"epochs {e:03d} --- loss {lossValue:.3f} (atc: {ATCLoss:.3f}  wait_time: {WTLoss:.3f})")